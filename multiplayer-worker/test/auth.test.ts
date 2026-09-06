import { env } from "cloudflare:workers";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { finishGoogleAuth } from "../src/auth";
import worker from "../src/index";
import type { Env } from "../src/types";

const origin = "https://teacher.example";
const email = "teacher@example.com";
let signingKey: CryptoKey;
let signingJwk: JsonWebKey & { kid: string };
const config = () => ({
  ...env,
  ENVIRONMENT: "production",
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  AUTH_ORIGIN: origin,
  TEACHER_EMAILS: email,
  ADMIN_EMAILS: "admin@example.com",
}) as Env;

beforeAll(async () => {
  const keys = await generateKeyPair("RS256");
  signingKey = keys.privateKey;
  signingJwk = { ...await exportJWK(keys.publicKey), kid: "test-key" };
});

beforeEach(async () => {
  await env.REPORTS.exec("DELETE FROM teacher_session_rooms; DELETE FROM teacher_sessions; DELETE FROM teacher_identities; DELETE FROM oauth_states; DELETE FROM auth_rate_limits;");
});

afterEach(() => vi.unstubAllGlobals());

async function begin(settings = config()) {
  const start = await worker.fetch(new Request(`${origin}/api/auth/google/start`), settings);
  const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
  const cookie = start.headers.get("set-cookie")!.split(";")[0];
  const saved = await env.REPORTS.prepare("SELECT nonce FROM oauth_states").first<{ nonce: string }>();
  return { settings, state, cookie, nonce: saved!.nonce };
}

async function token(
  claims: Record<string, unknown>,
  options: { audience?: string; expiresAt?: string | number | undefined; key?: CryptoKey } = {},
) {
  const jwt = new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer("https://accounts.google.com")
    .setAudience(options.audience ?? "client-id")
    .setSubject("google-subject")
    .setIssuedAt();
  if (options.expiresAt !== undefined) jwt.setExpirationTime(options.expiresAt);
  return jwt.sign(options.key ?? signingKey);
}

function mockGoogle(idToken: string) {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === "https://oauth2.googleapis.com/token") return Response.json({ id_token: idToken });
    if (url === "https://www.googleapis.com/oauth2/v3/certs") return Response.json({ keys: [signingJwk] });
    throw new Error(`Unexpected fetch ${url}`);
  });
}

async function authenticatedTeacher() {
  const flow = await begin();
  mockGoogle(await token({ email, email_verified: true, nonce: flow.nonce }, { expiresAt: "5m" }));
  const callback = await finishGoogleAuth(new Request(`${origin}/api/auth/google/callback?state=${flow.state}&code=one-time`, { headers: { cookie: flow.cookie } }), flow.settings);
  const cookie = callback.headers.getSetCookie().find((value) => value.startsWith("__Host-mg_teacher="))!.split(";")[0];
  const session = await worker.fetch(new Request(`${origin}/api/auth/session`, { headers: { cookie, origin } }), flow.settings);
  const body = await session.json<any>();
  return { ...flow, cookie, csrfToken: body.csrfToken as string };
}

describe("Google teacher authentication", () => {
  it("fails closed while configuration is absent", async () => {
    const missing = { ...env, GOOGLE_CLIENT_ID: undefined, GOOGLE_CLIENT_SECRET: undefined, AUTH_ORIGIN: undefined, TEACHER_EMAILS: undefined, ADMIN_EMAILS: undefined } as Env;
    const session = await worker.fetch(new Request(`${origin}/api/auth/session`), missing);
    expect(await session.json()).toEqual({ authenticated: false, configured: false });
    const start = await worker.fetch(new Request(`${origin}/api/auth/google/start`), missing);
    expect(start.status).toBe(503);
    expect(await start.json()).toMatchObject({ error: "AUTH_NOT_CONFIGURED" });
  });

  it("uses state, nonce, PKCE, a verified Google token, and a replay-safe session", async () => {
    const settings = config();
    const start = await worker.fetch(new Request(`${origin}/api/auth/google/start?returnTo=%2Fmultiplayer%2F%3Fteacher%3D1%26room%3D123456`), settings);
    expect(start.status).toBe(302);
    expect(start.headers.get("referrer-policy")).toBe("no-referrer");
    const authorization = new URL(start.headers.get("location")!);
    const state = authorization.searchParams.get("state")!;
    expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
    const stateCookie = start.headers.get("set-cookie")!.split(";")[0];
    const saved = await env.REPORTS.prepare("SELECT nonce FROM oauth_states").first<{ nonce: string }>();
    const idToken = await token({ email, email_verified: true, nonce: saved!.nonce, role: "admin" }, { expiresAt: "5m" });
    mockGoogle(idToken);
    const callbackRequest = new Request(`${origin}/api/auth/google/callback?state=${encodeURIComponent(state)}&code=one-time`, { headers: { cookie: stateCookie } });
    const callback = await finishGoogleAuth(callbackRequest, settings);
    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toBe(`${origin}/multiplayer/?teacher=1&room=123456`);
    const sessionCookie = callback.headers.getSetCookie().find((value) => value.startsWith("__Host-mg_teacher="))!.split(";")[0];
    const session = await worker.fetch(new Request(`${origin}/api/auth/session`, { headers: { cookie: sessionCookie, origin } }), settings);
    const body = await session.json<any>();
    expect(body).toMatchObject({ authenticated: true, configured: true, teacher: { email, role: "teacher" }, csrfToken: expect.any(String) });
    const browserGet = await worker.fetch(new Request(`${origin}/api/auth/session`, { headers: { cookie: sessionCookie } }), settings);
    expect((await browserGet.json<any>()).csrfToken).toBe(body.csrfToken);

    const replay = await worker.fetch(new Request(`${origin}/api/auth/google/callback?state=${encodeURIComponent(state)}&code=one-time`, { headers: { cookie: stateCookie } }), settings);
    expect(replay.headers.get("location")).toContain("auth_error=OAUTH_STATE_INVALID");
  });

  it("rejects legacy Access assertions and cross-origin callback starts", async () => {
    const settings = config();
    const crossOrigin = await worker.fetch(new Request("https://other.example/api/auth/google/start"), settings);
    expect(crossOrigin.status).toBe(403);
    const legacy = await worker.fetch(new Request(`${origin}/api/teacher/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json", "cf-access-jwt-assertion": "legacy" },
      body: "{}",
    }), settings);
    expect(legacy.status).toBe(401);
  });

  it("rejects mismatched and expired OAuth states before token exchange", async () => {
    const mismatch = await begin();
    const wrongCookie = await worker.fetch(new Request(`${origin}/api/auth/google/callback?state=${mismatch.state}&code=one-time`, { headers: { cookie: "__Host-mg_oauth_state=other" } }), mismatch.settings);
    expect(wrongCookie.headers.get("location")).toContain("auth_error=OAUTH_STATE_INVALID");

    const expired = await begin();
    await env.REPORTS.exec("UPDATE oauth_states SET expires_at = 0;");
    const expiredState = await worker.fetch(new Request(`${origin}/api/auth/google/callback?state=${expired.state}&code=one-time`, { headers: { cookie: expired.cookie } }), expired.settings);
    expect(expiredState.headers.get("location")).toContain("auth_error=OAUTH_STATE_INVALID");
  });

  it("derives admin only from ADMIN_EMAILS, never a Google role claim", async () => {
    const adminSettings = {
      ...config(),
      TEACHER_EMAILS: "",
      ADMIN_EMAILS: "admin@example.com",
    } as Env;
    const flow = await begin(adminSettings);
    mockGoogle(await token({ email: "admin@example.com", email_verified: true, nonce: flow.nonce, role: "teacher" }, { expiresAt: "5m" }));
    const callback = await finishGoogleAuth(new Request(`${origin}/api/auth/google/callback?state=${flow.state}&code=one-time`, { headers: { cookie: flow.cookie } }), flow.settings);
    const cookie = callback.headers.getSetCookie().find((value) => value.startsWith("__Host-mg_teacher="))!.split(";")[0];
    const session = await worker.fetch(new Request(`${origin}/api/auth/session`, { headers: { cookie } }), flow.settings);
    expect((await session.json<any>()).teacher).toEqual({ email: "admin@example.com", role: "admin" });
  });

  it("rejects protected POST origin and CSRF failures, then invalidates a logged-out session", async () => {
    const teacher = await authenticatedTeacher();
    const body = JSON.stringify({ grade: "g1", unitKey: "g1-l1-be-verb", durationSeconds: 300, questionCount: 5 });
    const protectedPost = (headers: Record<string, string>) => worker.fetch(new Request(`${origin}/api/teacher/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: teacher.cookie, ...headers },
      body,
    }), teacher.settings);
    expect((await protectedPost({})).status).toBe(403);
    expect((await protectedPost({ origin: "https://other.example", "x-csrf-token": teacher.csrfToken })).status).toBe(403);
    expect((await protectedPost({ origin })).status).toBe(403);
    expect((await protectedPost({ origin, "x-csrf-token": "wrong" })).status).toBe(403);
    expect((await protectedPost({ origin, "x-csrf-token": teacher.csrfToken })).status).toBe(201);

    const logout = await worker.fetch(new Request(`${origin}/api/auth/logout`, {
      method: "POST",
      headers: { cookie: teacher.cookie, origin, "x-csrf-token": teacher.csrfToken },
    }), teacher.settings);
    expect(logout.status).toBe(200);
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
    const afterLogout = await worker.fetch(new Request(`${origin}/api/auth/session`, { headers: { cookie: teacher.cookie } }), teacher.settings);
    expect(await afterLogout.json()).toMatchObject({ authenticated: false });
    const retry = await worker.fetch(new Request(`${origin}/api/auth/logout`, {
      method: "POST",
      headers: { cookie: teacher.cookie, origin, "x-csrf-token": teacher.csrfToken },
    }), teacher.settings);
    expect(retry.status).toBe(401);
  });

  it.each([
    { name: "a bad signature", claims: (nonce: string) => ({ email, email_verified: true, nonce }), options: async () => ({ expiresAt: "5m", key: (await generateKeyPair("RS256")).privateKey }), error: "OAUTH_TOKEN_INVALID" },
    { name: "a wrong audience", claims: (nonce: string) => ({ email, email_verified: true, nonce }), options: async () => ({ expiresAt: "5m", audience: "other-client" }), error: "OAUTH_TOKEN_INVALID" },
    { name: "an expired token", claims: (nonce: string) => ({ email, email_verified: true, nonce }), options: async () => ({ expiresAt: "-1s" }), error: "OAUTH_TOKEN_INVALID" },
    { name: "a token without exp", claims: (nonce: string) => ({ email, email_verified: true, nonce }), options: async () => ({}), error: "OAUTH_TOKEN_INVALID" },
    { name: "a wrong nonce", claims: () => ({ email, email_verified: true, nonce: "wrong-nonce" }), options: async () => ({ expiresAt: "5m" }), error: "OAUTH_CLAIMS_INVALID" },
    { name: "an unverified email", claims: (nonce: string) => ({ email, email_verified: false, nonce }), options: async () => ({ expiresAt: "5m" }), error: "OAUTH_CLAIMS_INVALID" },
    { name: "an unlisted email", claims: (nonce: string) => ({ email: "not-allowed@example.com", email_verified: true, nonce }), options: async () => ({ expiresAt: "5m" }), error: "TEACHER_NOT_ALLOWED" },
  ])("redirects safely for $name", async ({ claims, options, error }) => {
    const flow = await begin();
    mockGoogle(await token(claims(flow.nonce), await options()));
    const callback = await worker.fetch(new Request(`${origin}/api/auth/google/callback?state=${flow.state}&code=one-time`, { headers: { cookie: flow.cookie } }), flow.settings);
    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toContain(`auth_error=${error}`);
  });
});
