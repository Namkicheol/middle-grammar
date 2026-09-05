import {
  EngineError,
  createRoomState,
  joinPlayer,
  normalizeNickname,
  publicRoomState,
  startRoom,
  submitAnswer,
  teacherRoomState,
  type RoomState,
} from "./room-engine";
import type { Env, RoomInitBody, RoomRecord, SocketAttachment } from "./types";

const RECORD_KEY = "room";
const MAX_PLAYERS = 60;
const RECONNECT_WINDOW_MS = 60_000;
const TICKET_TTL_MS = 60_000;
const REPORT_RETRY_MS = 60_000;
const LOBBY_TTL_MS = 24 * 60 * 60_000;
const FINISHED_ROOM_TTL_MS = 24 * 60 * 60_000;

export class GameRoom implements DurableObject {
  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (request.method === "POST" && url.pathname === "/internal/initialize") {
        return await this.initialize(await request.json<RoomInitBody>());
      }
      if (request.method === "POST" && url.pathname === "/internal/join") {
        return await this.join(await request.json<{ nickname: string }>());
      }
      if (request.method === "POST" && url.pathname === "/internal/socket-ticket") {
        return await this.issueSocketTicket(request, await request.json<{ playerId: string }>());
      }
      if (request.method === "GET" && url.pathname === "/internal/state") {
        return await this.state(request, url);
      }
      if (request.method === "POST" && url.pathname === "/internal/start") {
        return await this.start(request);
      }
      if (request.method === "POST" && url.pathname === "/internal/finish") {
        return await this.finish(request);
      }
      if (request.method === "GET" && url.pathname === "/internal/ws") {
        return await this.openSocket(request, url);
      }
      return json({ error: "NOT_FOUND" }, 404);
    } catch (error) {
      return errorResponse(error);
    }
  }

  async alarm(): Promise<void> {
    const record = await this.getRecord();
    if (!record) return;
    const now = Date.now();
    if (record.state.status === "lobby") {
      if (now >= record.state.createdAt + LOBBY_TTL_MS) await this.cleanup();
      else await this.ctx.storage.setAlarm(record.state.createdAt + LOBBY_TTL_MS);
      return;
    }
    if (record.state.status === "playing") {
      const deadline = record.state.startedAt! + record.state.durationSeconds * 1_000;
      if (now >= deadline) await this.finishRoom(record, now);
      else await this.ctx.storage.setAlarm(deadline);
      return;
    }
    if (!record.reportStored) {
      await this.finishRoom(record, record.state.finishedAt ?? now);
      return;
    }
    const cleanupAt = (record.state.finishedAt ?? now) + FINISHED_ROOM_TTL_MS;
    if (now >= cleanupAt) await this.cleanup();
    else await this.ctx.storage.setAlarm(cleanupAt);
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = socket.deserializeAttachment() as SocketAttachment | null;
    try {
      const payload = JSON.parse(
        typeof message === "string" ? message : new TextDecoder().decode(message),
      ) as { type?: string; questionId?: string; occurrenceIndex?: number; answer?: string };
      if (
        payload.type !== "answer" ||
        attachment?.role !== "student" ||
        !attachment.playerId ||
        !attachment.resumeTokenHash ||
        typeof payload.questionId !== "string" ||
        !Number.isInteger(payload.occurrenceIndex) ||
        typeof payload.answer !== "string"
      ) {
        throw new EngineError("INVALID_ANSWER", "Invalid WebSocket message.");
      }
      const record = await this.requireRecord();
      await this.assertPlayerHash(record.state, attachment.playerId, attachment.resumeTokenHash);
      const submitted = submitAnswer(record.state, {
        playerId: attachment.playerId,
        questionId: payload.questionId,
        occurrenceIndex: payload.occurrenceIndex!,
        answer: payload.answer,
        serverNow: Date.now(),
      });
      record.state = submitted.state;
      await this.putRecord(record);
      socket.send(JSON.stringify({
        type: "answer_result",
        result: submitted.result,
        state: studentView(record, attachment.playerId),
      }));
      this.broadcastState(record);
    } catch (error) {
      socket.send(JSON.stringify(errorPayload(error)));
    }
  }

  async webSocketClose(socket: WebSocket): Promise<void> {
    const attachment = socket.deserializeAttachment() as SocketAttachment | null;
    if (attachment?.role !== "student" || !attachment.playerId) return;
    const hasAnotherSocket = this.ctx.getWebSockets().some((candidate) => {
      if (candidate === socket) return false;
      const other = candidate.deserializeAttachment() as SocketAttachment | null;
      return other?.role === "student" && other.playerId === attachment.playerId;
    });
    if (hasAnotherSocket) return;
    const record = await this.getRecord();
    if (!record) return;
    record.disconnectedAt[attachment.playerId] = Date.now();
    await this.putRecord(record);
  }

  private async initialize(body: RoomInitBody): Promise<Response> {
    if (await this.getRecord()) return json({ error: "ROOM_EXISTS" }, 409);
    const state = createRoomState({
      code: body.code,
      teacherEmail: body.teacherEmail,
      durationSeconds: body.durationSeconds,
      allowLateJoin: body.allowLateJoin,
      shuffleQuestions: body.shuffleQuestions,
      questions: body.questions,
      createdAt: body.createdAt,
    });
    const record: RoomRecord = {
      roomId: body.roomId,
      grade: body.grade,
      unitKey: body.unitKey,
      state,
      reportStored: false,
      socketTickets: {},
      disconnectedAt: {},
    };
    await this.ctx.storage.transaction(async (transaction) => {
      await transaction.put(RECORD_KEY, record);
      await transaction.setAlarm(state.createdAt + LOBBY_TTL_MS);
    });
    return json({ state: teacherView(record) }, 201);
  }

  private async join(body: { nickname: string }): Promise<Response> {
    const record = await this.requireRecord();
    if (Object.keys(record.state.players).length >= MAX_PLAYERS) {
      throw new ResponseError(409, "ROOM_FULL", "This room already has 60 players.");
    }
    const nickname = normalizeNickname(body.nickname);
    if (Object.values(record.state.players).some((player) => player.nickname === nickname)) {
      throw new ResponseError(409, "NICKNAME_TAKEN", "Choose a different nickname.");
    }
    const playerId = crypto.randomUUID();
    const resumeToken = randomSecret();
    const joined = joinPlayer(record.state, {
      id: playerId,
      nickname,
      resumeTokenHash: await sha256(resumeToken),
      joinedAt: Date.now(),
    });
    record.state = joined.state;
    await this.putRecord(record);
    this.broadcastState(record);
    return json({ playerId, resumeToken, state: studentView(record, playerId) }, 201);
  }

  private async issueSocketTicket(
    request: Request,
    body: { playerId: string },
  ): Promise<Response> {
    const record = await this.requireRecord();
    await this.assertPlayer(record.state, body.playerId, request.headers.get("x-resume-token") ?? "");
    const disconnectedAt = record.disconnectedAt[body.playerId];
    if (disconnectedAt !== undefined && Date.now() - disconnectedAt > RECONNECT_WINDOW_MS) {
      throw new ResponseError(410, "RECONNECT_EXPIRED", "The 60-second reconnect window expired.");
    }
    const ticket = randomSecret();
    const expiresAt = Date.now() + TICKET_TTL_MS;
    record.socketTickets[ticket] = { playerId: body.playerId, expiresAt };
    pruneTickets(record, Date.now());
    await this.putRecord(record);
    return json({ ticket, expiresAt });
  }

  private async state(request: Request, url: URL): Promise<Response> {
    const record = await this.requireRecord();
    const teacherEmail = request.headers.get("x-room-teacher-email");
    if (teacherEmail) {
      this.assertTeacher(record, teacherEmail);
      return json(teacherView(record));
    }
    const playerId = url.searchParams.get("playerId") ?? undefined;
    if (!playerId) return json(studentView(record));
    await this.assertPlayer(record.state, playerId, request.headers.get("x-resume-token") ?? "");
    return json(studentView(record, playerId));
  }

  private async start(request: Request): Promise<Response> {
    const record = await this.requireRecord();
    this.assertTeacher(record, request.headers.get("x-room-teacher-email") ?? "");
    const startedAt = Date.now();
    record.state = startRoom(record.state, startedAt);
    await this.ctx.storage.transaction(async (transaction) => {
      await transaction.put(RECORD_KEY, record);
      await transaction.setAlarm(startedAt + record.state.durationSeconds * 1_000);
    });
    this.broadcast("start", record);
    return json({ state: teacherView(record) });
  }

  private async finish(request: Request): Promise<Response> {
    const record = await this.requireRecord();
    this.assertTeacher(record, request.headers.get("x-room-teacher-email") ?? "");
    await this.finishRoom(record, Date.now());
    return json({ state: teacherView(record) });
  }

  private async openSocket(request: Request, url: URL): Promise<Response> {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return json({ error: "UPGRADE_REQUIRED" }, 426);
    }
    const record = await this.requireRecord();
    let attachment: SocketAttachment;
    const teacherEmail = request.headers.get("x-room-teacher-email");
    if (teacherEmail) {
      this.assertTeacher(record, teacherEmail);
      attachment = { role: "teacher" };
    } else {
      const ticket = url.searchParams.get("ticket") ?? "";
      const issued = record.socketTickets[ticket];
      if (!issued || issued.expiresAt < Date.now()) {
        delete record.socketTickets[ticket];
        await this.putRecord(record);
        throw new ResponseError(401, "INVALID_SOCKET_TICKET", "Socket ticket is invalid or expired.");
      }
      const player = record.state.players[issued.playerId];
      if (!player) throw new EngineError("UNKNOWN_PLAYER", "Player not found.");
      delete record.socketTickets[ticket];
      delete record.disconnectedAt[issued.playerId];
      attachment = { role: "student", playerId: issued.playerId, resumeTokenHash: player.resumeTokenHash };
      await this.putRecord(record);
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(attachment);
    server.send(JSON.stringify({ type: "hello", state: this.viewFor(record, attachment) }));
    return new Response(null, { status: 101, webSocket: client });
  }

  private async finishRoom(record: RoomRecord, finishedAt: number): Promise<void> {
    const firstFinish = record.state.status !== "finished";
    if (firstFinish) record.state = { ...record.state, status: "finished", finishedAt };
    if (record.reportStored) return;
    await this.ctx.storage.transaction(async (transaction) => {
      await transaction.put(RECORD_KEY, record);
      await transaction.setAlarm(Date.now() + REPORT_RETRY_MS);
    });
    if (firstFinish) this.broadcast("finish", record);
    try {
      await this.storeReport(record);
      record.reportStored = true;
      const cleanupAt = (record.state.finishedAt ?? finishedAt) + FINISHED_ROOM_TTL_MS;
      await this.ctx.storage.transaction(async (transaction) => {
        await transaction.put(RECORD_KEY, record);
        await transaction.setAlarm(cleanupAt);
      });
      if (!firstFinish) this.broadcast("finish", record);
    } catch (error) {
      await this.ctx.storage.setAlarm(Date.now() + REPORT_RETRY_MS);
      throw error;
    }
  }

  private async storeReport(record: RoomRecord): Promise<void> {
    const view = teacherRoomState(record.state);
    const statements: D1PreparedStatement[] = [
      this.env.REPORTS.prepare(
        `INSERT INTO room_reports
          (room_id, code, teacher_email, grade, unit_key, duration_seconds, question_count,
           participant_count, started_at, finished_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(room_id) DO UPDATE SET
           participant_count = excluded.participant_count,
           started_at = excluded.started_at,
           finished_at = excluded.finished_at`,
      ).bind(
        record.roomId,
        record.state.code,
        record.state.teacherEmail,
        record.grade,
        record.unitKey,
        record.state.durationSeconds,
        record.state.questions.length,
        view.participantCount,
        record.state.startedAt ?? null,
        record.state.finishedAt,
        record.state.createdAt,
      ),
      this.env.REPORTS.prepare("DELETE FROM player_results WHERE room_id = ?").bind(record.roomId),
      ...view.leaderboard.map((player) =>
        this.env.REPORTS.prepare(
          `INSERT INTO player_results
            (room_id, player_id, nickname, rank, score, accuracy, correct_count,
             answered_count, average_response_time_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          record.roomId,
          player.playerId,
          player.nickname,
          player.rank,
          player.score,
          player.accuracy,
          player.correctCount,
          player.answeredCount,
          player.averageResponseTimeMs,
        ),
      ),
    ];
    await this.env.REPORTS.batch(statements);
  }

  private broadcast(type: "start" | "finish", record: RoomRecord): void {
    this.sendEach(record, (attachment) => ({ type, state: this.viewFor(record, attachment) }));
  }

  private broadcastState(record: RoomRecord): void {
    this.sendEach(record, (attachment) => ({ type: "room_state", state: this.viewFor(record, attachment) }));
  }

  private sendEach(record: RoomRecord, payload: (attachment: SocketAttachment) => unknown): void {
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as SocketAttachment;
      try {
        socket.send(JSON.stringify(payload(attachment)));
      } catch {
        socket.close(1011, "Unable to update room");
      }
    }
  }

  private viewFor(record: RoomRecord, attachment: SocketAttachment) {
    return attachment.role === "teacher" ? teacherView(record) : studentView(record, attachment.playerId);
  }

  private async assertPlayer(state: RoomState, playerId: string, resumeToken: string): Promise<void> {
    await this.assertPlayerHash(state, playerId, await sha256(resumeToken));
  }

  private async assertPlayerHash(state: RoomState, playerId: string, tokenHash: string): Promise<void> {
    const player = state.players[playerId];
    if (!player || player.resumeTokenHash !== tokenHash) {
      throw new EngineError("UNKNOWN_PLAYER", "Reconnect identity is invalid.");
    }
  }

  private assertTeacher(record: RoomRecord, email: string): void {
    if (record.state.teacherEmail !== email.trim().toLowerCase()) {
      throw new ResponseError(403, "NOT_ROOM_OWNER", "This teacher does not own the room.");
    }
  }

  private async cleanup(): Promise<void> {
    for (const socket of this.ctx.getWebSockets()) socket.close(1001, "Room expired");
    await this.ctx.storage.deleteAll();
  }

  private async getRecord(): Promise<RoomRecord | undefined> {
    return this.ctx.storage.get<RoomRecord>(RECORD_KEY);
  }

  private async requireRecord(): Promise<RoomRecord> {
    const record = await this.getRecord();
    if (!record) throw new ResponseError(404, "ROOM_NOT_FOUND", "Room not found.");
    record.socketTickets ??= {};
    record.disconnectedAt ??= {};
    return record;
  }

  private async putRecord(record: RoomRecord): Promise<void> {
    await this.ctx.storage.put(RECORD_KEY, record);
  }
}

function teacherView(record: RoomRecord) {
  return { ...teacherRoomState(record.state), grade: record.grade, unitKey: record.unitKey };
}

function studentView(record: RoomRecord, playerId?: string) {
  return { ...publicRoomState(record.state, playerId), grade: record.grade, unitKey: record.unitKey };
}

function pruneTickets(record: RoomRecord, now: number): void {
  for (const [ticket, value] of Object.entries(record.socketTickets)) {
    if (value.expiresAt < now) delete record.socketTickets[ticket];
  }
}

class ResponseError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

function errorPayload(error: unknown) {
  if (error instanceof EngineError || error instanceof ResponseError) {
    return { type: "error", error: error.code, message: error.message };
  }
  console.error(error);
  return { type: "error", error: "INTERNAL_ERROR", message: "Unexpected room error." };
}

function errorResponse(error: unknown): Response {
  if (error instanceof EngineError) {
    const status = error.code === "DUPLICATE_ANSWER"
      ? 409
      : error.code === "UNKNOWN_PLAYER"
        ? 401
        : error.code === "ROOM_STARTED" || error.code === "ROOM_EXPIRED"
          ? 409
          : 400;
    return json({ error: error.code, message: error.message }, status);
  }
  if (error instanceof ResponseError) return json({ error: error.code, message: error.message }, error.status);
  console.error(error);
  return json({ error: "INTERNAL_ERROR" }, 500);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomSecret(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "cache-control": "no-store" } });
}
