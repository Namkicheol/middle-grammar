import { AuthError, requireTeacherSession } from "./auth";
import type { Env } from "./types";

type ModerationInput = { teacherId?: unknown; reason?: unknown };

export async function adminTeachers(request: Request, env: Env): Promise<Response> {
  const actor = await requireAdmin(request, env, "read");
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "all";
  if (!['all', 'active', 'banned'].includes(status)) throw new AuthError(400, "INVALID_STATUS", "Choose a valid teacher status.");
  const offset = parseOffset(url.searchParams.get("offset"));
  const search = (url.searchParams.get("search") ?? "").trim().toLowerCase().slice(0, 120);
  const statusSql = status === "active" ? "AND COALESCE(m.banned, 0) = 0" : status === "banned" ? "AND m.banned = 1" : "";
  const rows = await env.REPORTS.prepare(
    `SELECT i.google_sub, i.email, i.created_at, i.updated_at,
            COALESCE(m.banned, 0) AS banned, m.ban_reason, m.banned_at
       FROM teacher_identities i LEFT JOIN teacher_moderation m ON m.google_sub = i.google_sub
      WHERE (? = '' OR instr(lower(i.email), ?) > 0) ${statusSql}
      ORDER BY i.updated_at DESC, i.google_sub ASC LIMIT 51 OFFSET ?`,
  ).bind(search, search, offset).all<Record<string, unknown>>();
  const teachers = rows.results.slice(0, 50).map((row) => ({
    id: row.google_sub, email: row.email,
    role: adminEmails(env).has(String(row.email).toLowerCase()) ? "admin" : "teacher",
    createdAt: row.created_at, lastLoginAt: row.updated_at,
    banned: Boolean(row.banned), banReason: row.ban_reason ?? null, bannedAt: row.banned_at ?? null,
  }));
  void actor;
  return Response.json({ teachers, hasMore: rows.results.length > 50 });
}

export async function banTeacher(request: Request, env: Env): Promise<Response> {
  const actor = await requireAdmin(request, env, "mutation");
  const { teacherId, reason } = await input(request);
  const target = await identity(env, teacherId);
  guardTarget(env, actor.email, target);
  const now = Date.now();
  const sessions = await env.REPORTS.prepare(
    `SELECT s.session_hash, r.room_code FROM teacher_sessions s
       LEFT JOIN teacher_session_rooms r ON r.session_hash = s.session_hash
      WHERE s.google_sub = ?`,
  ).bind(teacherId).all<{ session_hash: string; room_code: string | null }>();
  await env.REPORTS.batch([
    env.REPORTS.prepare(`INSERT INTO teacher_moderation (google_sub,banned,ban_reason,banned_at,banned_by,updated_at)
      VALUES (?,1,?,?,?,?) ON CONFLICT(google_sub) DO UPDATE SET banned=1,ban_reason=excluded.ban_reason,banned_at=excluded.banned_at,banned_by=excluded.banned_by,updated_at=excluded.updated_at`).bind(teacherId, reason, now, actor.email, now),
    env.REPORTS.prepare("INSERT INTO teacher_moderation_audit (google_sub,action,actor_email,reason,created_at) VALUES (?,'ban',?,?,?)").bind(teacherId, actor.email, reason, now),
    env.REPORTS.prepare("UPDATE teacher_sessions SET revoked_at = COALESCE(revoked_at, ?) WHERE google_sub = ?").bind(now, teacherId),
  ]);
  let revocationFailed = false;
  for (const row of sessions.results) if (row.room_code) {
    const response = await env.ROOMS.getByName(row.room_code).fetch("https://room/internal/revoke-teacher-session", { method: "POST", headers: { "x-room-teacher-session-hash": row.session_hash } });
    if (!response.ok) revocationFailed = true;
  }
  if (revocationFailed) throw new AuthError(503, "BAN_SESSION_REVOCATION_FAILED", "The account was disabled, but active classrooms could not all be disconnected. Retry the ban.");
  return Response.json({ ok: true });
}

export async function unbanTeacher(request: Request, env: Env): Promise<Response> {
  const actor = await requireAdmin(request, env, "mutation");
  const { teacherId } = await input(request);
  const target = await identity(env, teacherId);
  guardTarget(env, actor.email, target);
  const now = Date.now();
  await env.REPORTS.batch([
    env.REPORTS.prepare("UPDATE teacher_moderation SET banned=0,ban_reason=NULL,banned_at=NULL,banned_by=NULL,updated_at=? WHERE google_sub=?").bind(now, teacherId),
    env.REPORTS.prepare("INSERT INTO teacher_moderation_audit (google_sub,action,actor_email,reason,created_at) VALUES (?,'unban',?,NULL,?)").bind(teacherId, actor.email, now),
  ]);
  return Response.json({ ok: true });
}

async function requireAdmin(request: Request, env: Env, purpose: "read" | "mutation") {
  const actor = await requireTeacherSession(request, env, purpose);
  if (actor.role !== "admin") throw new AuthError(403, "ADMIN_REQUIRED", "Administrator access required.");
  if (actor.developmentBypass && request.headers.get("origin") !== new URL(request.url).origin) throw new AuthError(403, "ORIGIN_INVALID", "Request origin is not allowed.");
  return actor;
}
async function input(request: Request): Promise<{ teacherId: string; reason: string | null }> {
  const body = await request.json<ModerationInput>();
  if (!body || typeof body !== "object" || typeof body.teacherId !== "string" || !/^[A-Za-z0-9:_-]{1,255}$/.test(body.teacherId)) throw new AuthError(400, "INVALID_TEACHER_ID", "Choose a valid teacher.");
  if (body.reason !== undefined && (typeof body.reason !== "string" || body.reason.trim().length > 300)) throw new AuthError(400, "INVALID_BAN_REASON", "Reason must be 300 characters or fewer.");
  return { teacherId: body.teacherId, reason: typeof body.reason === "string" ? body.reason.trim() || null : null };
}
async function identity(env: Env, sub: string) {
  const row = await env.REPORTS.prepare("SELECT google_sub,email FROM teacher_identities WHERE google_sub=?").bind(sub).first<{google_sub:string;email:string}>();
  if (!row) throw new AuthError(404, "TEACHER_NOT_FOUND", "Teacher not found.");
  return row;
}
function guardTarget(env: Env, actorEmail: string, target: { email: string }) {
  const email = target.email.toLowerCase();
  if (email === actorEmail.toLowerCase()) throw new AuthError(400, "ADMIN_SELF_MODERATION", "You cannot moderate your own account.");
  if (adminEmails(env).has(email)) throw new AuthError(400, "ADMIN_TARGET_PROTECTED", "Administrator accounts cannot be moderated here.");
}
function adminEmails(env: Env) { return new Set((env.ADMIN_EMAILS ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean)); }
function parseOffset(value: string | null) { if (value === null) return 0; const n=Number(value); if (!Number.isInteger(n)||n<0||n>100000) throw new AuthError(400,"INVALID_OFFSET","Choose a valid offset."); return n; }
