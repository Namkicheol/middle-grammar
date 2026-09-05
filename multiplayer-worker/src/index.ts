import { createRemoteJWKSet, jwtVerify } from "jose";
import { renderSVG } from "uqr";
import bundledQuestionBank from "./generated/questions.json";
import { GameRoom } from "./room";
import type { Env, QuestionBank } from "./types";
import type { PlayStyle, Question, RoomMode } from "./room-engine";

export { GameRoom };

const ROOM_CODE = "(?<code>\\d{6})";
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (request.method === "POST" && url.pathname === "/api/teacher/rooms") {
        return await createRoom(request, env, url.origin);
      }

      const teacherState = url.pathname.match(new RegExp(`^/api/teacher/rooms/${ROOM_CODE}/state$`));
      if (request.method === "GET" && teacherState?.groups?.code) {
        return await forward(
          env,
          teacherState.groups.code,
          "/internal/state",
          request,
          { "x-room-teacher-email": await requireTeacher(request, env) },
        );
      }

      const teacherControl = url.pathname.match(
        new RegExp(`^/api/teacher/rooms/${ROOM_CODE}/(?<action>start|finish)$`),
      );
      if (request.method === "POST" && teacherControl?.groups?.code) {
        return await forward(
          env,
          teacherControl.groups.code,
          `/internal/${teacherControl.groups.action}`,
          request,
          { "x-room-teacher-email": await requireTeacher(request, env) },
        );
      }

      const teacherSocket = url.pathname.match(new RegExp(`^/api/teacher/rooms/${ROOM_CODE}/ws$`));
      if (request.method === "GET" && teacherSocket?.groups?.code) {
        const internal = new URL("https://room/internal/ws");
        const headers = new Headers(request.headers);
        const loopbackDevEmail = env.ENVIRONMENT !== "production" && isLoopbackHost(url.hostname)
          ? url.searchParams.get("devTeacherEmail") ?? undefined
          : undefined;
        headers.set("x-room-teacher-email", await requireTeacher(request, env, loopbackDevEmail));
        return env.ROOMS.getByName(teacherSocket.groups.code).fetch(new Request(internal, { headers }));
      }

      const joinMatch = url.pathname.match(new RegExp(`^/api/rooms/${ROOM_CODE}/join$`));
      if (request.method === "POST" && joinMatch?.groups?.code) {
        return await forward(env, joinMatch.groups.code, "/internal/join", request);
      }

      const stateMatch = url.pathname.match(new RegExp(`^/api/rooms/${ROOM_CODE}/state$`));
      if (request.method === "GET" && stateMatch?.groups?.code) {
        const internal = new URL("https://room/internal/state");
        const playerId = url.searchParams.get("playerId");
        if (playerId) internal.searchParams.set("playerId", playerId);
        const headers = new Headers();
        const resumeToken = request.headers.get("x-resume-token");
        if (resumeToken) headers.set("x-resume-token", resumeToken);
        return env.ROOMS.getByName(stateMatch.groups.code).fetch(new Request(internal, { headers }));
      }

      const ticketMatch = url.pathname.match(
        new RegExp(`^/api/rooms/${ROOM_CODE}/socket-ticket$`),
      );
      if (request.method === "POST" && ticketMatch?.groups?.code) {
        return await forward(
          env,
          ticketMatch.groups.code,
          "/internal/socket-ticket",
          request,
          { "x-resume-token": request.headers.get("x-resume-token") ?? "" },
        );
      }

      const studentSocket = url.pathname.match(new RegExp(`^/api/rooms/${ROOM_CODE}/ws$`));
      if (request.method === "GET" && studentSocket?.groups?.code) {
        const internal = new URL("https://room/internal/ws");
        const ticket = url.searchParams.get("ticket");
        if (ticket) internal.searchParams.set("ticket", ticket);
        const headers = new Headers();
        const upgrade = request.headers.get("upgrade");
        if (upgrade) headers.set("upgrade", upgrade);
        return env.ROOMS.getByName(studentSocket.groups.code).fetch(
          new Request(internal, { headers }),
        );
      }

      const qrMatch = url.pathname.match(new RegExp(`^/api/rooms/${ROOM_CODE}/qr\\.svg$`));
      if (request.method === "GET" && qrMatch?.groups?.code) {
        const joinUrl = `${url.origin}/multiplayer/?room=${qrMatch.groups.code}`;
        return new Response(renderSVG(joinUrl, { ecc: "M", border: 3 }), {
          headers: {
            "content-type": "image/svg+xml; charset=utf-8",
            "cache-control": "public, max-age=300",
            "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
            "x-content-type-options": "nosniff",
            "x-join-url": joinUrl,
          },
        });
      }

      const reportMatch = url.pathname.match(new RegExp(`^/api/teacher/reports/${ROOM_CODE}$`));
      if (request.method === "GET" && reportMatch?.groups?.code) {
        return await teacherReport(env, reportMatch.groups.code, await requireTeacher(request, env));
      }

      if (url.pathname === "/multiplayer") {
        return Response.redirect(`${url.origin}/multiplayer/${url.search}`, 308);
      }
      if (env.ASSETS && request.method === "GET" && url.pathname.startsWith("/multiplayer/")) {
        const assetUrl = new URL(request.url);
        const assetPath = assetUrl.pathname.slice("/multiplayer".length) || "/";
        assetUrl.pathname = assetPath === "/" ? "/index.html" : assetPath;
        return env.ASSETS.fetch(new Request(assetUrl, request));
      }
      return json({ error: "NOT_FOUND" }, 404);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.code, message: error.message }, error.status);
      if (error instanceof SyntaxError) return json({ error: "INVALID_JSON" }, 400);
      console.error(error);
      return json({ error: "INTERNAL_ERROR" }, 500);
    }
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const cutoff = Date.now() - 90 * 24 * 60 * 60_000;
    await env.REPORTS.batch([
      env.REPORTS.prepare(
        "DELETE FROM player_results WHERE room_id IN (SELECT room_id FROM room_reports WHERE finished_at < ?)",
      ).bind(cutoff),
      env.REPORTS.prepare("DELETE FROM room_reports WHERE finished_at < ?").bind(cutoff),
    ]);
  },
} satisfies ExportedHandler<Env>;

async function createRoom(request: Request, env: Env, origin: string): Promise<Response> {
  const teacherEmail = await requireTeacher(request, env);
  assertContentLength(request, 3_000_000);
  const rawBody = await request.json<unknown>();
  if (!isPlainObject(rawBody)) {
    throw new HttpError(400, "INVALID_REQUEST", "Room settings must be a JSON object.");
  }
  const body = rawBody as {
    grade?: string;
    unitKey?: string;
    mode?: RoomMode;
    playStyle?: PlayStyle;
    teamCount?: number;
    setTitle?: string;
    customQuestions?: Array<{
      prompt?: string;
      question?: string;
      answer?: string;
      choices?: string[];
      image?: string;
    }>;
    durationSeconds?: number;
    questionCount?: number;
    allowLateJoin?: boolean;
    shuffleQuestions?: boolean;
  };
  const mode = body.mode ?? "score_race";
  if (!["score_race", "treasure_heist", "maze_heist"].includes(mode)) {
    throw new HttpError(400, "INVALID_MODE", "Choose a valid game mode.");
  }
  const playStyle = body.playStyle ?? "individual";
  if (playStyle !== "individual" && playStyle !== "team") {
    throw new HttpError(400, "INVALID_PLAY_STYLE", "Choose individual or team play.");
  }
  if (playStyle === "team" && (!Number.isInteger(body.teamCount) || body.teamCount! < 2 || body.teamCount! > 4)) {
    throw new HttpError(400, "INVALID_TEAM_COUNT", "Team play requires 2 to 4 teams.");
  }
  if (playStyle === "individual" && body.teamCount !== undefined) {
    throw new HttpError(400, "INVALID_TEAM_COUNT", "Team count is only available for team play.");
  }
  if (![60, 180, 300, 420, 600].includes(body.durationSeconds ?? 0)) {
    throw new HttpError(400, "INVALID_DURATION", "Choose 1, 3, 5, 7, or 10 minutes.");
  }
  if (!Number.isInteger(body.questionCount) || (body.questionCount ?? 0) < 1) {
    throw new HttpError(400, "INVALID_QUESTION_COUNT", "Choose at least one question.");
  }
  if (body.allowLateJoin !== undefined && typeof body.allowLateJoin !== "boolean") {
    throw new HttpError(400, "INVALID_LATE_JOIN", "Late join setting must be true or false.");
  }
  if (body.shuffleQuestions !== undefined && typeof body.shuffleQuestions !== "boolean") {
    throw new HttpError(400, "INVALID_SHUFFLE", "Shuffle setting must be true or false.");
  }
  const allowLateJoin = body.allowLateJoin ?? true;
  const shuffleQuestions = body.shuffleQuestions ?? true;
  if (body.customQuestions !== undefined && !Array.isArray(body.customQuestions)) {
    throw new HttpError(400, "INVALID_CUSTOM_SET", "Custom questions must be a list.");
  }
  const customQuestions = Array.isArray(body.customQuestions) ? normalizeCustomQuestions(body.customQuestions) : null;
  let grade: string;
  let unitKey: string;
  let setTitle = "";
  let questions: Question[];
  if (customQuestions) {
    if (customQuestions.length < 5) throw new HttpError(400, "INVALID_CUSTOM_SET", "Add at least five custom questions.");
    if (body.questionCount !== customQuestions.length) {
      throw new HttpError(400, "INVALID_QUESTION_COUNT", "Custom question count does not match.");
    }
    grade = "custom";
    unitKey = "custom-local";
    setTitle = String(body.setTitle || "내 퀴즈 세트").trim().slice(0, 80) || "내 퀴즈 세트";
    questions = customQuestions;
  } else {
    if (body.grade !== "g1" && body.grade !== "g2") throw new HttpError(400, "INVALID_GRADE", "Choose a valid grade.");
    if (typeof body.unitKey !== "string" || !body.unitKey.startsWith(`${body.grade}-`)) {
      throw new HttpError(400, "INVALID_UNIT", "Choose a unit in the selected grade.");
    }
    const pool = questionBank(env).units[body.unitKey];
    if (!pool?.length) throw new HttpError(400, "INVALID_UNIT", "Question unit not found.");
    if (body.questionCount! > pool.length) throw new HttpError(400, "INVALID_QUESTION_COUNT", "That unit has fewer questions.");
    grade = body.grade;
    unitKey = body.unitKey;
    questions = shuffleQuestions ? randomSample(pool, body.questionCount!) : pool.slice(0, body.questionCount!);
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomCode();
    const response = await env.ROOMS.getByName(code).fetch("https://room/internal/initialize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        roomId: crypto.randomUUID(),
        code,
        teacherEmail,
        grade,
        unitKey,
        setTitle,
        durationSeconds: body.durationSeconds,
        allowLateJoin,
        shuffleQuestions,
        mode,
        playStyle,
        teamCount: playStyle === "team" ? body.teamCount : undefined,
        questions,
        createdAt: Date.now(),
      }),
    });
    if (response.status === 409) continue;
    if (!response.ok) return response;
    const payload = await response.json<{ state: unknown }>();
    return json({ code, joinUrl: `${origin}/multiplayer/?room=${code}`, state: payload.state }, 201);
  }
  throw new HttpError(503, "ROOM_CODE_UNAVAILABLE", "Try creating the room again.");
}

function normalizeCustomQuestions(input: unknown[]): Question[] {
  if (input.length > 30) throw new HttpError(400, "INVALID_CUSTOM_SET", "Use 30 questions or fewer.");
  let imageBytes = 0;
  const base = input.map((item, index) => {
    if (!isPlainObject(item)) {
      throw new HttpError(400, "INVALID_CUSTOM_SET", `Question ${index + 1} is invalid.`);
    }
    const prompt = String(item.prompt || item.question || "").trim();
    const answer = String(item.answer || "").trim();
    if (!prompt || !answer || prompt.length > 500 || answer.length > 200) {
      throw new HttpError(400, "INVALID_CUSTOM_SET", `Question ${index + 1} is incomplete or too long.`);
    }
    const image = String(item.image || "");
    if (image) {
      if (!/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(image) || image.length > 350_000) {
        throw new HttpError(400, "INVALID_CUSTOM_IMAGE", `Question ${index + 1} image is invalid or too large.`);
      }
      imageBytes += image.length;
    }
    return {
      id: `custom-${index + 1}`,
      kor: "직접 만든 문제",
      eng: prompt,
      ans: answer,
      opts: [...new Set((Array.isArray(item.choices) ? item.choices : []).map((value) => String(value).trim()).filter(Boolean))].slice(0, 4),
      level: "custom",
      type: "mcq",
      ...(image ? { image } : {}),
    } satisfies Question;
  });
  if (imageBytes > 2_500_000) throw new HttpError(400, "INVALID_CUSTOM_IMAGE", "Custom set images are too large together.");
  const answerPool = [...new Set(base.map((question) => question.ans))];
  return base.map((question) => {
    const opts = [...new Set([question.ans, ...question.opts, ...answerPool.filter((answer) => answer !== question.ans)])].slice(0, 4);
    if (opts.length < 2) throw new HttpError(400, "INVALID_CUSTOM_SET", "Custom questions need at least two different answers.");
    return { ...question, opts };
  });
}

async function forward(
  env: Env,
  code: string,
  path: string,
  source: Request,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  assertContentLength(source, 3_000_000);
  const headers = new Headers(extraHeaders);
  const contentType = source.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  return env.ROOMS.getByName(code).fetch(`https://room${path}`, {
    method: source.method,
    headers,
    body: source.body,
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function assertContentLength(request: Request, maxBytes: number): void {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) return;
  const length = Number(contentLength);
  if (!Number.isSafeInteger(length) || length < 0 || length > maxBytes) {
    throw new HttpError(413, "REQUEST_TOO_LARGE", "Request body is too large.");
  }
}

async function teacherReport(env: Env, code: string, email: string): Promise<Response> {
  const room = await env.REPORTS.prepare(
    `SELECT * FROM room_reports
     WHERE code = ? AND teacher_email = ?
     ORDER BY finished_at DESC, created_at DESC
     LIMIT 1`,
  ).bind(code, email).first<Record<string, unknown>>();
  if (!room) return json({ error: "REPORT_NOT_FOUND" }, 404);
  const players = await env.REPORTS.prepare(
    "SELECT * FROM player_results WHERE room_id = ? ORDER BY rank ASC",
  ).bind(room.room_id).all<Record<string, unknown>>();
  return json({
    room: camelRoom(room),
    players: players.results.map((row) => camelPlayer(row, code)),
  });
}

async function requireTeacher(
  request: Request,
  env: Env,
  loopbackDevEmail?: string,
): Promise<string> {
  if (env.ENVIRONMENT !== "production" && isLoopbackHost(new URL(request.url).hostname)) {
    const devEmail = (request.headers.get("x-dev-teacher-email") || loopbackDevEmail)
      ?.trim()
      .toLowerCase();
    if (devEmail) return devEmail;
  }
  const assertion = request.headers.get("cf-access-jwt-assertion");
  if (!assertion) throw new HttpError(401, "TEACHER_LOGIN_REQUIRED", "Teacher login required.");
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    throw new HttpError(503, "ACCESS_CONFIG_MISSING", "Cloudflare Access is not configured.");
  }
  const issuer = normalizeTeamDomain(env.ACCESS_TEAM_DOMAIN);
  let jwks = jwksCache.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    jwksCache.set(issuer, jwks);
  }
  try {
    const { payload } = await jwtVerify(assertion, jwks, {
      issuer,
      audience: env.ACCESS_AUD,
    });
    if (typeof payload.email !== "string" || !payload.email.trim()) throw new Error("Missing email claim");
    return payload.email.trim().toLowerCase();
  } catch {
    throw new HttpError(401, "INVALID_ACCESS_TOKEN", "Cloudflare Access token is invalid.");
  }
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function normalizeTeamDomain(value: string): string {
  const withScheme = value.startsWith("https://") ? value : `https://${value}`;
  return withScheme.replace(/\/+$/, "");
}

function camelRoom(row: Record<string, unknown>) {
  return {
    code: row.code,
    teacherEmail: row.teacher_email,
    grade: row.grade,
    unitKey: row.unit_key,
    mode: row.mode || "score_race",
    playStyle: row.play_style || "individual",
    teamCount: row.team_count || undefined,
    setTitle: row.set_title || "",
    durationSeconds: row.duration_seconds,
    questionCount: row.question_count,
    participantCount: row.participant_count,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
  };
}

function camelPlayer(row: Record<string, unknown>, code: string) {
  return {
    roomCode: code,
    playerId: row.player_id,
    nickname: row.nickname,
    rank: row.rank,
    score: row.score,
    accuracy: row.accuracy,
    correctCount: row.correct_count,
    answeredCount: row.answered_count,
    averageResponseTimeMs: row.average_response_time_ms,
    teamId: row.team_id || undefined,
    teamNumber: row.team_number || undefined,
  };
}

function questionBank(env: Env): QuestionBank {
  if (env.ENVIRONMENT !== "production" && env.QUESTION_BANK_JSON) {
    return JSON.parse(env.QUESTION_BANK_JSON) as QuestionBank;
  }
  return bundledQuestionBank as QuestionBank;
}

function randomCode(): string {
  return String((crypto.getRandomValues(new Uint32Array(1))[0] % 900_000) + 100_000);
}

function randomSample<T>(values: T[], count: number): T[] {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const random = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
    const swapIndex = Math.floor(random * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output.slice(0, count);
}

class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "cache-control": "no-store" } });
}
