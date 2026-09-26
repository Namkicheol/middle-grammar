import { env } from "cloudflare:workers";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { finishGoogleAuth, requireTeacherSession } from "../src/auth";
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
  TEACHER_SIGNUP_MODE: undefined,
  TEACHER_EMAILS: email,
  ADMIN_EMAILS: "admin@example.com",
}) as Env;

const openConfig = () => ({
  ...config(),
  TEACHER_SIGNUP_MODE: "open",
  TEACHER_EMAILS: "",
}) as Env;

beforeAll(async () => {
  const keys = await generateKeyPair("RS256");
  signingKey = keys.privateKey;
  signingJwk = { ...await exportJWK(keys.publicKey), kid: "test-key" };
});

beforeEach(async () => {
  await env.REPORTS.exec("DELETE FROM teacher_moderation_audit; DELETE FROM teacher_moderation; DELETE FROM teacher_quiz_sets; DELETE FROM teacher_session_rooms; DELETE FROM teacher_sessions; DELETE FROM teacher_identities; DELETE FROM oauth_states; DELETE FROM auth_rate_limits;");
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
  options: { audience?: string; expiresAt?: string | number | undefined; key?: CryptoKey; subject?: string } = {},
) {
  const jwt = new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer("https://accounts.google.com")
    .setAudience(options.audience ?? "client-id")
    .setSubject(options.subject ?? "google-subject")
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
  it("allows only the exact admin page as an additional login return path", async () => {
    const allowed=await worker.fetch(new Request(`${origin}/api/auth/google/start?returnTo=${encodeURIComponent("/multiplayer/admin.html")}`),config());
    expect(allowed.status).toBe(302);
    expect(new URL(allowed.headers.get("location")!).hostname).toBe("accounts.google.com");
    expect((await env.REPORTS.prepare("SELECT return_to FROM oauth_states").first<{return_to:string}>())?.return_to).toBe("/multiplayer/admin.html");
    for (const value of ["/multiplayer/admin.html?next=/", "/other/admin.html", "https://evil.example/multiplayer/admin.html"]) {
      const response=await worker.fetch(new Request(`${origin}/api/auth/google/start?returnTo=${encodeURIComponent(value)}`),config());
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({error:"RETURN_TO_INVALID"});
    }
  });

  it("allows the development email query only for a loopback same-origin teacher websocket", async () => {
    const settings = { ...config(), ENVIRONMENT: "development" } as Env;
    for (const headers of [
      { upgrade: "websocket" },
      { upgrade: "websocket", origin: "http://127.0.0.1" },
    ]) {
      const session = await requireTeacherSession(
        new Request("http://127.0.0.1/api/teacher/rooms/123456/socket?devTeacherEmail=teacher%40local.test", { headers: headers as Record<string, string> }),
        settings,
        "websocket",
      );
      expect(session).toMatchObject({
        email: "teacher@local.test",
        role: "teacher",
        sessionHash: "dev:teacher%40local.test",
        developmentBypass: true,
      });
    }
  });

  it.each([
    { name: "ordinary reads", url: "http://127.0.0.1/api/auth/session?devTeacherEmail=teacher%40local.test", purpose: "read" as const, headers: {} },
    { name: "mutations", url: "http://127.0.0.1/api/teacher/rooms?devTeacherEmail=teacher%40local.test", purpose: "mutation" as const, headers: { upgrade: "websocket" } },
    { name: "non-websocket requests", url: "http://127.0.0.1/api/teacher/rooms/123456/socket?devTeacherEmail=teacher%40local.test", purpose: "websocket" as const, headers: {} },
    { name: "cross-origin websocket requests", url: "http://127.0.0.1/api/teacher/rooms/123456/socket?devTeacherEmail=teacher%40local.test", purpose: "websocket" as const, headers: { upgrade: "websocket", origin: "http://localhost:8787" } },
    { name: "public development hosts", url: "https://preview.example/api/teacher/rooms/123456/socket?devTeacherEmail=teacher%40local.test", purpose: "websocket" as const, headers: { upgrade: "websocket", origin: "https://preview.example" } },
  ])("rejects a development email query on $name", async ({ url, purpose, headers }) => {
    const settings = { ...config(), ENVIRONMENT: "development" } as Env;
    await expect(requireTeacherSession(new Request(url, { headers: headers as Record<string, string> }), settings, purpose)).rejects.toMatchObject({
      status: 401,
      code: "TEACHER_LOGIN_REQUIRED",
    });
  });

  it("rejects the loopback websocket query bypass in production", async () => {
    await expect(requireTeacherSession(new Request(
      "http://127.0.0.1/api/teacher/rooms/123456/socket?devTeacherEmail=teacher%40local.test",
      { headers: { upgrade: "websocket", origin: "http://127.0.0.1" } },
    ), config(), "websocket")).rejects.toMatchObject({ status: 401, code: "TEACHER_LOGIN_REQUIRED" });
  });

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

  it("enrolls an unknown verified Google account as a teacher in open mode", async () => {
    const flow = await begin(openConfig());
    mockGoogle(await token({ email: "new-teacher@example.net", email_verified: true, nonce: flow.nonce }, { expiresAt: "5m" }));
    const callback = await finishGoogleAuth(new Request(`${origin}/api/auth/google/callback?state=${flow.state}&code=one-time`, { headers: { cookie: flow.cookie } }), flow.settings);
    const cookie = callback.headers.getSetCookie().find((value) => value.startsWith("__Host-mg_teacher="))!.split(";")[0];
    const session = await worker.fetch(new Request(`${origin}/api/auth/session`, { headers: { cookie } }), flow.settings);
    expect((await session.json<any>()).teacher).toEqual({ email: "new-teacher@example.net", role: "teacher" });
  });

  it("rejects a banned Google subject before creating a new session", async () => {
    const settings=openConfig(); const flow=await begin(settings); const now=Date.now();
    await env.REPORTS.prepare("INSERT INTO teacher_identities (google_sub,email,created_at,updated_at) VALUES (?,?,?,?)").bind("banned-sub","banned@example.net",now,now).run();
    await env.REPORTS.prepare("INSERT INTO teacher_moderation (google_sub,banned,ban_reason,banned_at,banned_by,updated_at) VALUES (?,1,NULL,?,?,?)").bind("banned-sub",now,"admin@example.com",now).run();
    mockGoogle(await token({email:"banned@example.net",email_verified:true,nonce:flow.nonce},{expiresAt:"5m",subject:"banned-sub"}));
    const response=await worker.fetch(new Request(`${origin}/api/auth/google/callback?state=${flow.state}&code=one-time`,{headers:{cookie:flow.cookie}}),settings);
    expect(response.headers.get("location")).toContain("auth_error=TEACHER_BANNED");
    expect((await env.REPORTS.prepare("SELECT count(*) AS count FROM teacher_sessions WHERE google_sub=?").bind("banned-sub").first<{count:number}>())?.count).toBe(0);
  });

  it("keeps ADMIN_EMAILS accounts as admins in open mode", async () => {
    const flow = await begin(openConfig());
    mockGoogle(await token({ email: "admin@example.com", email_verified: true, nonce: flow.nonce }, { expiresAt: "5m" }));
    const callback = await finishGoogleAuth(new Request(`${origin}/api/auth/google/callback?state=${flow.state}&code=one-time`, { headers: { cookie: flow.cookie } }), flow.settings);
    const cookie = callback.headers.getSetCookie().find((value) => value.startsWith("__Host-mg_teacher="))!.split(";")[0];
    const session = await worker.fetch(new Request(`${origin}/api/auth/session`, { headers: { cookie } }), flow.settings);
    expect((await session.json<any>()).teacher).toEqual({ email: "admin@example.com", role: "admin" });
  });

  it("never enrolls an unverified Google email in open mode", async () => {
    const flow = await begin(openConfig());
    mockGoogle(await token({ email: "unverified@example.net", email_verified: false, nonce: flow.nonce }, { expiresAt: "5m" }));
    const callback = await worker.fetch(new Request(`${origin}/api/auth/google/callback?state=${flow.state}&code=one-time`, { headers: { cookie: flow.cookie } }), flow.settings);
    expect(callback.headers.get("location")).toContain("auth_error=OAUTH_CLAIMS_INVALID");
  });

  it("keeps allowlist mode as the fail-closed default", async () => {
    const flow = await begin(config());
    mockGoogle(await token({ email: "unknown@example.net", email_verified: true, nonce: flow.nonce }, { expiresAt: "5m" }));
    const callback = await worker.fetch(new Request(`${origin}/api/auth/google/callback?state=${flow.state}&code=one-time`, { headers: { cookie: flow.cookie } }), flow.settings);
    expect(callback.headers.get("location")).toContain("auth_error=TEACHER_NOT_ALLOWED");
  });

  it("keeps identity subject and email bindings in open mode", async () => {
    const settings = openConfig();
    const first = await begin(settings);
    mockGoogle(await token({ email: "bound@example.net", email_verified: true, nonce: first.nonce }, { expiresAt: "5m", subject: "bound-subject" }));
    await finishGoogleAuth(new Request(`${origin}/api/auth/google/callback?state=${first.state}&code=one-time`, { headers: { cookie: first.cookie } }), settings);

    const changedEmail = await begin(settings);
    mockGoogle(await token({ email: "changed@example.net", email_verified: true, nonce: changedEmail.nonce }, { expiresAt: "5m", subject: "bound-subject" }));
    const changedEmailResponse = await worker.fetch(new Request(`${origin}/api/auth/google/callback?state=${changedEmail.state}&code=one-time`, { headers: { cookie: changedEmail.cookie } }), settings);
    expect(changedEmailResponse.headers.get("location")).toContain("auth_error=IDENTITY_EMAIL_MISMATCH");

    const changedSubject = await begin(settings);
    mockGoogle(await token({ email: "bound@example.net", email_verified: true, nonce: changedSubject.nonce }, { expiresAt: "5m", subject: "other-subject" }));
    const changedSubjectResponse = await worker.fetch(new Request(`${origin}/api/auth/google/callback?state=${changedSubject.state}&code=one-time`, { headers: { cookie: changedSubject.cookie } }), settings);
    expect(changedSubjectResponse.headers.get("location")).toContain("auth_error=IDENTITY_SUB_MISMATCH");
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
