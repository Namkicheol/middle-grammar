import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Env } from "./types";

const GOOGLE_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const OAUTH_TTL_MS = 10 * 60_000;
const SESSION_TTL_MS = 8 * 60 * 60_000;
const START_RATE_LIMIT = 10;
const jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

export type TeacherRole = "admin" | "teacher";

export interface TeacherSession {
  email: string;
  role: TeacherRole;
  sessionHash: string;
  expiresAt: number;
  csrfToken?: string;
  developmentBypass?: boolean;
}

export class AuthError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

interface AuthConfig {
  clientId: string;
  clientSecret: string;
  origin: string;
  teachers: Set<string>;
  admins: Set<string>;
}

export function authConfigured(env: Env): boolean {
  return config(env) !== null;
}

export async function sessionResponse(request: Request, env: Env): Promise<Response> {
  const configured = authConfigured(env);
  const session = await teacherSessionFromRequest(request, env);
  const payload: Record<string, unknown> = { authenticated: !!session, configured };
  if (session) {
    payload.teacher = { email: session.email, role: session.role };
    if (session.csrfToken) payload.csrfToken = session.csrfToken;
  }
  return json(payload);
}

export async function startGoogleAuth(request: Request, env: Env): Promise<Response> {
  const settings = requireConfig(env);
  assertAuthOrigin(request, settings);
  const url = new URL(request.url);
  const now = Date.now();
  await enforceStartRateLimit(env, request, now);
  const returnTo = normalizeReturnTo(url.searchParams.get("returnTo"));
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken();
  await env.REPORTS.prepare(
    `INSERT INTO oauth_states (state_hash, nonce, code_verifier, return_to, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(await sha256(state), nonce, verifier, returnTo, now, now + OAUTH_TTL_MS).run();
  const authorization = new URL(GOOGLE_AUTHORIZATION_URL);
  authorization.searchParams.set("client_id", settings.clientId);
  authorization.searchParams.set("redirect_uri", `${settings.origin}/api/auth/google/callback`);
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("scope", "openid email");
  authorization.searchParams.set("state", state);
  authorization.searchParams.set("nonce", nonce);
  authorization.searchParams.set("code_challenge", await pkceChallenge(verifier));
  authorization.searchParams.set("code_challenge_method", "S256");
  const response = redirect(authorization.toString());
  response.headers.append("set-cookie", cookie(stateCookieName(env), state, env, OAUTH_TTL_MS, true));
  return response;
}

export async function finishGoogleAuth(request: Request, env: Env): Promise<Response> {
  const settings = requireConfig(env);
  assertAuthOrigin(request, settings);
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!state || !code) throw new AuthError(400, "OAUTH_CALLBACK_INVALID", "Google login could not be completed.");
  const stateCookie = readCookie(request, stateCookieName(env));
  if (!stateCookie || !safeEqual(stateCookie, state)) {
    throw new AuthError(400, "OAUTH_STATE_INVALID", "Google login could not be completed.");
  }
  const now = Date.now();
  const saved = await env.REPORTS.prepare(
    `DELETE FROM oauth_states WHERE state_hash = ? AND expires_at > ?
     RETURNING nonce, code_verifier, return_to`,
  ).bind(await sha256(state), now).first<{ nonce: string; code_verifier: string; return_to: string }>();
  if (!saved) throw new AuthError(400, "OAUTH_STATE_INVALID", "Google login could not be completed.");

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        redirect_uri: `${settings.origin}/api/auth/google/callback`,
        grant_type: "authorization_code",
        code_verifier: saved.code_verifier,
      }),
    });
  } catch {
    throw new AuthError(502, "OAUTH_TOKEN_EXCHANGE_FAILED", "Google login could not be completed.");
  }
  if (!tokenResponse.ok) throw new AuthError(401, "OAUTH_TOKEN_EXCHANGE_FAILED", "Google login could not be completed.");
  let token: { id_token?: unknown };
  try { token = await tokenResponse.json<{ id_token?: unknown }>(); } catch {
    throw new AuthError(401, "OAUTH_TOKEN_INVALID", "Google login could not be completed.");
  }
  if (typeof token.id_token !== "string") throw new AuthError(401, "OAUTH_TOKEN_INVALID", "Google login could not be completed.");
  let claims: { sub?: unknown; email?: unknown; email_verified?: unknown; nonce?: unknown };
  try {
    const verified = await jwtVerify(token.id_token, jwks, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: settings.clientId,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "sub", "email", "email_verified", "nonce"],
    });
    claims = verified.payload;
  } catch {
    throw new AuthError(401, "OAUTH_TOKEN_INVALID", "Google login could not be completed.");
  }
  if (typeof claims.sub !== "string" || !claims.sub || typeof claims.email !== "string" || claims.email_verified !== true ||
    typeof claims.nonce !== "string" || !safeEqual(claims.nonce, saved.nonce)) {
    throw new AuthError(401, "OAUTH_CLAIMS_INVALID", "Google login could not be completed.");
  }
  const email = normalizeEmail(claims.email);
  const role = roleFor(settings, email);
  if (!role) throw new AuthError(403, "TEACHER_NOT_ALLOWED", "This Google account is not approved for teacher access.");
  await bindIdentity(env, claims.sub, email, now);
  const rawToken = randomToken();
  const csrfToken = await csrfFor(rawToken);
  const expiresAt = now + SESSION_TTL_MS;
  const sessionHash = await sha256(rawToken);
  await env.REPORTS.prepare(
    `INSERT INTO teacher_sessions
     (session_hash, google_sub, email, csrf_hash, created_at, expires_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
  ).bind(sessionHash, claims.sub, email, await sha256(csrfToken), now, expiresAt).run();
  const response = redirect(`${settings.origin}${saved.return_to}`);
  response.headers.append("set-cookie", cookie(sessionCookieName(env), rawToken, env, SESSION_TTL_MS, true));
  response.headers.append("set-cookie", clearCookie(stateCookieName(env), env));
  return response;
}

export function callbackErrorResponse(request: Request, env: Env, error: AuthError): Response {
  const origin = config(env)?.origin ?? new URL(request.url).origin;
  const response = redirect(`${origin}/multiplayer/?teacher=1&auth_error=${encodeURIComponent(error.code)}`);
  response.headers.append("set-cookie", clearCookie(stateCookieName(env), env));
  return response;
}

export async function requireTeacherSession(
  request: Request,
  env: Env,
  purpose: "read" | "mutation" | "websocket" = "read",
): Promise<TeacherSession> {
  const development = developmentSession(request, env);
  if (development) return development;
  const rawToken = readCookie(request, sessionCookieName(env));
  if (!rawToken) throw new AuthError(401, "TEACHER_LOGIN_REQUIRED", "Teacher login required.");
  const session = await getSessionByToken(env, rawToken);
  if (!session) throw new AuthError(401, "TEACHER_LOGIN_REQUIRED", "Teacher login required.");
  if (purpose === "mutation") {
    assertSameOrigin(request, env);
    const csrf = request.headers.get("x-csrf-token") ?? "";
    if (!session.csrfToken || !safeEqual(csrf, session.csrfToken)) {
      throw new AuthError(403, "CSRF_INVALID", "Request verification failed.");
    }
  }
  if (purpose === "websocket") assertSameOrigin(request, env);
  return session;
}

export async function getTeacherSessionByHash(env: Env, sessionHash: string): Promise<TeacherSession | null> {
  if (sessionHash.startsWith("dev:")) return null;
  const row = await env.REPORTS.prepare(
    `SELECT email, expires_at FROM teacher_sessions
     WHERE session_hash = ? AND expires_at > ? AND revoked_at IS NULL`,
  ).bind(sessionHash, Date.now()).first<{ email: string; expires_at: number }>();
  if (!row) return null;
  const email = normalizeEmail(row.email);
  const role = roleForConfig(env, email);
  return role ? { email, role, sessionHash, expiresAt: row.expires_at } : null;
}

export async function registerTeacherRoomSession(env: Env, sessionHash: string, roomCode: string): Promise<void> {
  if (sessionHash.startsWith("dev:")) return;
  await env.REPORTS.prepare(
    "INSERT OR IGNORE INTO teacher_session_rooms (session_hash, room_code) VALUES (?, ?)",
  ).bind(sessionHash, roomCode).run();
}

export async function beginLogout(request: Request, env: Env): Promise<{ sessionHash: string; roomCodes: string[] }> {
  const development = developmentSession(request, env);
  if (development) return { sessionHash: development.sessionHash, roomCodes: [] };
  assertSameOrigin(request, env);
  const rawToken = readCookie(request, sessionCookieName(env));
  if (!rawToken) throw new AuthError(401, "TEACHER_LOGIN_REQUIRED", "Teacher login required.");
  const sessionHash = await sha256(rawToken);
  const session = await env.REPORTS.prepare(
    `SELECT email, csrf_hash FROM teacher_sessions
     WHERE session_hash = ? AND expires_at > ?`,
  ).bind(sessionHash, Date.now()).first<{ email: string; csrf_hash: string }>();
  if (!session || !roleForConfig(env, normalizeEmail(session.email))) {
    throw new AuthError(401, "TEACHER_LOGIN_REQUIRED", "Teacher login required.");
  }
  const csrf = request.headers.get("x-csrf-token") ?? "";
  const expectedCsrf = await csrfFor(rawToken);
  if (!safeEqual(await sha256(expectedCsrf), session.csrf_hash) || !safeEqual(csrf, expectedCsrf)) {
    throw new AuthError(403, "CSRF_INVALID", "Request verification failed.");
  }
  const roomRows = await env.REPORTS.prepare(
    "SELECT room_code FROM teacher_session_rooms WHERE session_hash = ?",
  ).bind(sessionHash).all<{ room_code: string }>();
  await env.REPORTS.prepare(
    "UPDATE teacher_sessions SET revoked_at = COALESCE(revoked_at, ?) WHERE session_hash = ?",
  ).bind(Date.now(), sessionHash).run();
  return { sessionHash, roomCodes: roomRows.results.map((row) => row.room_code) };
}

export async function finishLogout(env: Env, sessionHash: string): Promise<void> {
  if (sessionHash.startsWith("dev:")) return;
  await env.REPORTS.batch([
    env.REPORTS.prepare("DELETE FROM teacher_session_rooms WHERE session_hash = ?").bind(sessionHash),
    env.REPORTS.prepare("DELETE FROM teacher_sessions WHERE session_hash = ?").bind(sessionHash),
  ]);
}

export function logoutResponse(env: Env): Response {
  const response = json({ ok: true });
  response.headers.append("set-cookie", clearCookie(sessionCookieName(env), env));
  return response;
}

export async function cleanupAuth(env: Env, now = Date.now()): Promise<void> {
  await env.REPORTS.batch([
    env.REPORTS.prepare("DELETE FROM oauth_states WHERE expires_at <= ?").bind(now),
    env.REPORTS.prepare("DELETE FROM teacher_session_rooms WHERE session_hash IN (SELECT session_hash FROM teacher_sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL)").bind(now),
    env.REPORTS.prepare("DELETE FROM teacher_sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL").bind(now),
    env.REPORTS.prepare("DELETE FROM auth_rate_limits WHERE expires_at <= ?").bind(now),
  ]);
}

function config(env: Env): AuthConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const origin = env.AUTH_ORIGIN?.trim();
  if (!clientId || !clientSecret || !origin) return null;
  let parsed: URL;
  try { parsed = new URL(origin); } catch { return null; }
  if (env.ENVIRONMENT === "production" && parsed.protocol !== "https:") return null;
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
  const teachers = emails(env.TEACHER_EMAILS);
  const admins = emails(env.ADMIN_EMAILS);
  if (teachers.size + admins.size === 0) return null;
  return { clientId, clientSecret, origin: parsed.origin, teachers, admins };
}

function requireConfig(env: Env): AuthConfig {
  const settings = config(env);
  if (!settings) throw new AuthError(503, "AUTH_NOT_CONFIGURED", "Google login connection is not ready.");
  return settings;
}

function roleForConfig(env: Env, email: string): TeacherRole | null {
  const settings = config(env);
  return settings ? roleFor(settings, email) : null;
}

function roleFor(settings: AuthConfig, email: string): TeacherRole | null {
  if (settings.admins.has(email)) return "admin";
  return settings.teachers.has(email) ? "teacher" : null;
}

function emails(value?: string): Set<string> {
  return new Set((value ?? "").split(",").map(normalizeEmail).filter(Boolean));
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function assertAuthOrigin(request: Request, settings: AuthConfig): void {
  if (new URL(request.url).origin !== settings.origin) {
    throw new AuthError(403, "AUTH_ORIGIN_INVALID", "Google login connection is not available from this origin.");
  }
}

function normalizeReturnTo(value: string | null): string {
  const parsed = new URL(value || "/multiplayer/?teacher=1", "https://return.local");
  if (parsed.origin !== "https://return.local" || parsed.pathname !== "/multiplayer/" ||
    parsed.searchParams.get("teacher") !== "1" || [...parsed.searchParams.keys()].some((key) => key !== "teacher" && key !== "room")) {
    throw new AuthError(400, "RETURN_TO_INVALID", "Choose a valid return location.");
  }
  const room = parsed.searchParams.get("room");
  if (room !== null && !/^\d{6}$/.test(room)) throw new AuthError(400, "RETURN_TO_INVALID", "Choose a valid return location.");
  return `/multiplayer/?teacher=1${room ? `&room=${room}` : ""}`;
}

async function enforceStartRateLimit(env: Env, request: Request, now: number): Promise<void> {
  const identity = request.headers.get("cf-connecting-ip") ?? "unknown";
  const key = await sha256(`google-start:${identity}`);
  const expiresAt = now + OAUTH_TTL_MS;
  const row = await env.REPORTS.prepare(
    `INSERT INTO auth_rate_limits (rate_key, count, expires_at) VALUES (?, 1, ?)
     ON CONFLICT(rate_key) DO UPDATE SET
       count = CASE WHEN auth_rate_limits.expires_at <= ? THEN 1 ELSE auth_rate_limits.count + 1 END,
       expires_at = CASE WHEN auth_rate_limits.expires_at <= ? THEN excluded.expires_at ELSE auth_rate_limits.expires_at END
     RETURNING count`,
  ).bind(key, expiresAt, now, now).first<{ count: number }>();
  if (!row || row.count > START_RATE_LIMIT) throw new AuthError(429, "AUTH_RATE_LIMITED", "Please wait before trying Google login again.");
}

async function bindIdentity(env: Env, sub: string, email: string, now: number): Promise<void> {
  const bySub = await env.REPORTS.prepare("SELECT email FROM teacher_identities WHERE google_sub = ?").bind(sub).first<{ email: string }>();
  if (bySub && normalizeEmail(bySub.email) !== email) throw new AuthError(403, "IDENTITY_EMAIL_MISMATCH", "Teacher identity changed.");
  const byEmail = await env.REPORTS.prepare("SELECT google_sub FROM teacher_identities WHERE email = ?").bind(email).first<{ google_sub: string }>();
  if (byEmail && byEmail.google_sub !== sub) throw new AuthError(403, "IDENTITY_SUB_MISMATCH", "Teacher identity changed.");
  if (!bySub && !byEmail) {
    await env.REPORTS.prepare(
      "INSERT INTO teacher_identities (google_sub, email, created_at, updated_at) VALUES (?, ?, ?, ?)",
    ).bind(sub, email, now, now).run();
  } else {
    await env.REPORTS.prepare("UPDATE teacher_identities SET updated_at = ? WHERE google_sub = ?").bind(now, sub).run();
  }
}

async function getSessionByToken(env: Env, rawToken: string): Promise<TeacherSession | null> {
  const sessionHash = await sha256(rawToken);
  const row = await env.REPORTS.prepare(
    `SELECT email, csrf_hash, expires_at FROM teacher_sessions
     WHERE session_hash = ? AND expires_at > ? AND revoked_at IS NULL`,
  ).bind(sessionHash, Date.now()).first<{ email: string; csrf_hash: string; expires_at: number }>();
  if (!row) return null;
  const email = normalizeEmail(row.email);
  const role = roleForConfig(env, email);
  if (!role) return null;
  const csrfToken = await csrfFor(rawToken);
  if (!safeEqual(await sha256(csrfToken), row.csrf_hash)) return null;
  return { email, role, sessionHash, expiresAt: row.expires_at, csrfToken };
}

function developmentSession(request: Request, env: Env): TeacherSession | null {
  if (env.ENVIRONMENT === "production" || !isLoopbackHost(new URL(request.url).hostname)) return null;
  const email = normalizeEmail(request.headers.get("x-dev-teacher-email") ?? "");
  if (!email) return null;
  return {
    email,
    role: roleForConfig(env, email) ?? "teacher",
    sessionHash: `dev:${encodeURIComponent(email)}`,
    expiresAt: Date.now() + SESSION_TTL_MS,
    developmentBypass: true,
  };
}

async function teacherSessionFromRequest(request: Request, env: Env): Promise<TeacherSession | null> {
  const development = developmentSession(request, env);
  if (development) return development;
  const rawToken = readCookie(request, sessionCookieName(env));
  if (!rawToken) return null;
  const session = await getSessionByToken(env, rawToken);
  if (!session) return null;
  return sameOriginSessionRead(request, env) ? session : { ...session, csrfToken: undefined };
}

function assertSameOrigin(request: Request, env: Env): void {
  if (!sameOrigin(request, env)) {
    throw new AuthError(403, "ORIGIN_INVALID", "Request origin is not allowed.");
  }
}

function sameOrigin(request: Request, env: Env): boolean {
  const expected = config(env)?.origin ?? new URL(request.url).origin;
  return request.headers.get("origin") === expected;
}

function sameOriginSessionRead(request: Request, env: Env): boolean {
  const origin = request.headers.get("origin");
  if (origin) return sameOrigin(request, env);
  const site = request.headers.get("sec-fetch-site");
  return site === null || site === "same-origin";
}

function sessionCookieName(env: Env): string { return env.ENVIRONMENT === "production" ? "__Host-mg_teacher" : "mg_teacher"; }
function stateCookieName(env: Env): string { return env.ENVIRONMENT === "production" ? "__Host-mg_oauth_state" : "mg_oauth_state"; }

function cookie(name: string, value: string, env: Env, maxAgeMs: number, httpOnly: boolean): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${Math.floor(maxAgeMs / 1_000)}; SameSite=Lax;${httpOnly ? " HttpOnly;" : ""}${env.ENVIRONMENT === "production" ? " Secure;" : ""}`;
}

function clearCookie(name: string, env: Env): string {
  return `${name}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly;${env.ENVIRONMENT === "production" ? " Secure;" : ""}`;
}

function readCookie(request: Request, name: string): string | undefined {
  const match = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!match) return undefined;
  try { return decodeURIComponent(match.slice(name.length + 1)); } catch { return undefined; }
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64Url(bytes);
}

async function pkceChallenge(verifier: string): Promise<string> { return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)))); }
async function csrfFor(token: string): Promise<string> { return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`csrf:${token}`)))); }
async function sha256(value: string): Promise<string> { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (byte) => byte.toString(16).padStart(2, "0")).join(""); }
function base64Url(bytes: Uint8Array): string { let output = ""; for (const byte of bytes) output += String.fromCharCode(byte); return btoa(output).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); }
function safeEqual(left: string, right: string): boolean { if (left.length !== right.length) return false; let diff = 0; for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index); return diff === 0; }
function json(value: unknown, status = 200): Response { return Response.json(value, { status, headers: { "cache-control": "no-store" } }); }
function redirect(location: string): Response { return new Response(null, { status: 302, headers: { location, "cache-control": "no-store", "referrer-policy": "no-referrer" } }); }
