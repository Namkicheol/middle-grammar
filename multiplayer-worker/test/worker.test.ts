import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../src/index";
import type { Env, RoomRecord } from "../src/types";

const TEACHER = "teacher@example.com";
const inspectDurableObject = runInDurableObject as unknown as (
  stub: DurableObjectStub,
  callback: (instance: unknown, state: DurableObjectState) => Promise<void>,
) => Promise<void>;

function request(path: string, init: RequestInit = {}, override: Partial<Env> = {}) {
  return worker.fetch(
    new Request(`http://127.0.0.1${path}`, init),
    { ...env, ...override } as Env,
  );
}

async function createRoom(
  teacher = TEACHER,
  settings: Record<string, unknown> = {},
) {
  const response = await request("/api/teacher/rooms", {
    method: "POST",
    headers: { "content-type": "application/json", "x-dev-teacher-email": teacher },
    body: JSON.stringify({
      grade: "g1",
      unitKey: "g1-l1-be-verb",
      durationSeconds: 300,
      questionCount: 5,
      ...settings,
    }),
  });
  return { response, body: await response.json<any>() };
}

async function join(code: string, nickname: string) {
  const response = await request(`/api/rooms/${code}/join`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nickname }),
  });
  return { response, body: await response.json<any>() };
}

async function socketTicket(code: string, playerId: string, resumeToken: string) {
  const response = await request(`/api/rooms/${code}/socket-ticket`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-resume-token": resumeToken },
    body: JSON.stringify({ playerId }),
  });
  return { response, body: await response.json<any>() };
}

async function nextMessage(socket: WebSocket) {
  return new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("WebSocket message timed out")), 1_000);
    socket.addEventListener("message", (event) => {
      clearTimeout(timeout);
      resolve(JSON.parse(String(event.data)));
    }, { once: true });
  });
}

beforeEach(async () => {
  await env.REPORTS.exec("DELETE FROM player_results; DELETE FROM room_reports;");
});

describe("teacher authentication and ownership", () => {
  it("rejects the development teacher header on a public preview hostname", async () => {
    const response = await worker.fetch(
      new Request("https://preview.example/api/teacher/rooms", {
        method: "POST",
        headers: { "content-type": "application/json", "x-dev-teacher-email": TEACHER },
        body: "{}",
      }),
      { ...env, ENVIRONMENT: "development" } as Env,
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "TEACHER_LOGIN_REQUIRED" });
  });

  it("rejects forged email and development headers in production", async () => {
    const headerSets: Array<Record<string, string>> = [
      { "cf-access-authenticated-user-email": TEACHER },
      { "x-dev-teacher-email": TEACHER },
    ];
    for (const headers of headerSets) {
      const response = await request("/api/teacher/rooms", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: "{}",
      }, { ENVIRONMENT: "production" });
      expect(response.status).toBe(401);
    }
  });

  it("fails closed when a production JWT arrives without Access configuration", async () => {
    const response = await request("/api/teacher/rooms", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-access-jwt-assertion": "not-a-jwt" },
      body: "{}",
    }, { ENVIRONMENT: "production", ACCESS_TEAM_DOMAIN: undefined, ACCESS_AUD: undefined });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "ACCESS_CONFIG_MISSING" });
  });

  it("rejects an invalid production JWT even when Access is configured", async () => {
    const response = await request("/api/teacher/rooms", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-access-jwt-assertion": "not-a-jwt" },
      body: "{}",
    }, {
      ENVIRONMENT: "production",
      ACCESS_TEAM_DOMAIN: "school.cloudflareaccess.com",
      ACCESS_AUD: "expected-audience",
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "INVALID_ACCESS_TOKEN" });
  });

  it("keeps teacher state on a separate owner-only path", async () => {
    const { body } = await createRoom();
    const allowed = await request(`/api/teacher/rooms/${body.code}/state`, {
      headers: { "x-dev-teacher-email": TEACHER },
    });
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toMatchObject({ grade: "g1", unitKey: "g1-l1-be-verb" });

    const denied = await request(`/api/teacher/rooms/${body.code}/state`, {
      headers: { "x-dev-teacher-email": "other@example.com" },
    });
    expect(denied.status).toBe(403);
  });

  it("allows the teacher WebSocket query identity only on loopback development", async () => {
    const { body } = await createRoom();
    const path = `/api/teacher/rooms/${body.code}/ws?devTeacherEmail=${encodeURIComponent(TEACHER)}`;
    const development = await worker.fetch(
      new Request(`http://127.0.0.1${path}`, { headers: { upgrade: "websocket" } }),
      { ...env, ENVIRONMENT: "development" } as Env,
    );
    expect(development.status).toBe(101);
    const socket = development.webSocket!;
    socket.accept();
    expect(await nextMessage(socket)).toMatchObject({ type: "hello", state: { code: body.code } });
    socket.close(1000, "test complete");

    const production = await worker.fetch(
      new Request(`http://127.0.0.1${path}`, { headers: { upgrade: "websocket" } }),
      { ...env, ENVIRONMENT: "production" } as Env,
    );
    expect(production.status).toBe(401);
    expect(await production.json()).toMatchObject({ error: "TEACHER_LOGIN_REQUIRED" });
  });
});

describe("room routes", () => {
  it("creates a six-digit room with a multiplayer join URL and scoped state", async () => {
    const { response, body } = await createRoom();
    expect(response.status).toBe(201);
    expect(body.code).toMatch(/^\d{6}$/);
    expect(body.joinUrl).toBe(`http://127.0.0.1/multiplayer/?room=${body.code}`);
    expect(body.state).toMatchObject({
      status: "lobby",
      participantCount: 0,
      grade: "g1",
      unitKey: "g1-l1-be-verb",
      allowLateJoin: true,
      shuffleQuestions: true,
    });
  });

  it("accepts 7 and 10 minute rooms and applies late-join controls", async () => {
    for (const durationSeconds of [420, 600]) {
      const { response } = await createRoom(TEACHER, { durationSeconds });
      expect(response.status).toBe(201);
    }

    const blocked = await createRoom(TEACHER, { allowLateJoin: false });
    await request(`/api/teacher/rooms/${blocked.body.code}/start`, {
      method: "POST",
      headers: { "x-dev-teacher-email": TEACHER },
    });
    expect((await join(blocked.body.code, "차단 학생")).response.status).toBe(409);

    const open = await createRoom(TEACHER, { allowLateJoin: true });
    await request(`/api/teacher/rooms/${open.body.code}/start`, {
      method: "POST",
      headers: { "x-dev-teacher-email": TEACHER },
    });
    expect((await join(open.body.code, "늦은 학생")).response.status).toBe(201);
  });

  it("keeps the unit's stable first questions when shuffleQuestions is false", async () => {
    const { body: room } = await createRoom(TEACHER, { shuffleQuestions: false });
    const { body: player } = await join(room.code, "순서 확인");
    await request(`/api/teacher/rooms/${room.code}/start`, {
      method: "POST",
      headers: { "x-dev-teacher-email": TEACHER },
    });
    const state = await request(`/api/rooms/${room.code}/state?playerId=${player.playerId}`, {
      headers: { "x-resume-token": player.resumeToken },
    });
    expect((await state.json<any>()).self.currentQuestion.id).toBe("g1_l1_be_verb_a1");
  });

  it("rejects a duplicate normalized nickname and keeps peer accuracy private", async () => {
    const { body: room } = await createRoom();
    const first = await join(room.code, "  같은   이름  ");
    expect(first.response.status).toBe(201);
    const duplicate = await join(room.code, "같은 이름");
    expect(duplicate.response.status).toBe(409);
    expect(duplicate.body).toMatchObject({ error: "NICKNAME_TAKEN" });
    await join(room.code, "다른 이름");

    const state = await request(`/api/rooms/${room.code}/state?playerId=${first.body.playerId}`, {
      headers: { "x-resume-token": first.body.resumeToken },
    });
    const view = await state.json<any>();
    expect(view.participantCount).toBe(2);
    expect(view.self).toMatchObject({ playerId: first.body.playerId, accuracy: 0 });
    for (const entry of view.leaderboard) {
      expect(entry).not.toHaveProperty("accuracy");
      expect(entry).not.toHaveProperty("playerId");
    }
  });

  it("serves mapped multiplayer assets and a QR targeting that route", async () => {
    const asset = await request("/multiplayer/");
    expect(asset.status).toBe(200);
    expect(asset.headers.get("content-type")).toContain("text/html");

    const { body } = await createRoom();
    const qr = await request(`/api/rooms/${body.code}/qr.svg`);
    expect(qr.status).toBe(200);
    expect(qr.headers.get("x-join-url")).toBe(
      `http://127.0.0.1/multiplayer/?room=${body.code}`,
    );
    expect(await qr.text()).toContain("<svg");
  });

  it("removes the HTTP answer endpoint", async () => {
    const { body } = await createRoom();
    const response = await request(`/api/rooms/${body.code}/answer`, { method: "POST" });
    expect(response.status).toBe(404);
  });
});

describe("socket tickets and scoring", () => {
  it("never lets the public student socket inject the trusted teacher header", async () => {
    const { body: room } = await createRoom();
    const forgedStudent = await request(`/api/rooms/${room.code}/ws`, {
      headers: {
        upgrade: "websocket",
        "x-room-teacher-email": TEACHER,
      },
    });
    expect(forgedStudent.status).toBe(401);
    expect(await forgedStudent.json()).toMatchObject({ error: "INVALID_SOCKET_TICKET" });

    const unauthenticatedTeacher = await request(
      `/api/teacher/rooms/${room.code}/ws`,
      { headers: { upgrade: "websocket", "x-room-teacher-email": TEACHER } },
      { ENVIRONMENT: "production" },
    );
    expect(unauthenticatedTeacher.status).toBe(401);
    expect(await unauthenticatedTeacher.json()).toMatchObject({
      error: "TEACHER_LOGIN_REQUIRED",
    });
  });

  it("uses a single-use ticket, sends hello, and rejects a duplicate answer over WebSocket", async () => {
    const { body: room } = await createRoom();
    const { body: player } = await join(room.code, "소켓 학생");
    await request(`/api/teacher/rooms/${room.code}/start`, {
      method: "POST",
      headers: { "x-dev-teacher-email": TEACHER },
    });
    const { response: ticketResponse, body: issued } = await socketTicket(
      room.code,
      player.playerId,
      player.resumeToken,
    );
    expect(ticketResponse.status).toBe(200);
    expect(issued.ticket).toMatch(/^[a-f0-9]{64}$/);

    const upgrade = () => request(`/api/rooms/${room.code}/ws?ticket=${issued.ticket}`, {
      headers: { upgrade: "websocket" },
    });
    const response = await upgrade();
    expect(response.status).toBe(101);
    expect((await upgrade()).status).toBe(401);
    const socket = response.webSocket!;
    socket.accept();
    const hello = await nextMessage(socket);
    expect(hello).toMatchObject({
      type: "hello",
      state: { self: { playerId: player.playerId }, grade: "g1" },
    });
    const question = hello.state.self.currentQuestion;
    socket.send(JSON.stringify({
      type: "answer",
      questionId: question.id,
      occurrenceIndex: question.occurrenceIndex,
      answer: question.opts[0],
    }));
    expect((await nextMessage(socket)).type).toBe("answer_result");
    expect((await nextMessage(socket)).type).toBe("room_state");
    socket.send(JSON.stringify({
      type: "answer",
      questionId: question.id,
      occurrenceIndex: question.occurrenceIndex,
      answer: question.opts[0],
    }));
    expect(await nextMessage(socket)).toMatchObject({ type: "error", error: "DUPLICATE_ANSWER" });
    socket.close(1000, "test complete");
  });

  it("rejects an expired socket ticket", async () => {
    const { body: room } = await createRoom();
    const { body: player } = await join(room.code, "만료 학생");
    const { body: issued } = await socketTicket(room.code, player.playerId, player.resumeToken);
    const stub = env.ROOMS.getByName(room.code);
    await inspectDurableObject(stub, async (_instance, state) => {
      const record = await state.storage.get<RoomRecord>("room");
      record!.socketTickets[issued.ticket].expiresAt = 0;
      await state.storage.put("room", record!);
    });
    const response = await request(`/api/rooms/${room.code}/ws?ticket=${issued.ticket}`, {
      headers: { upgrade: "websocket" },
    });
    expect(response.status).toBe(401);
  });

  it("rejects reconnect ticket issuance after the 60-second window", async () => {
    const { body: room } = await createRoom();
    const { body: player } = await join(room.code, "재접속 만료");
    const stub = env.ROOMS.getByName(room.code);
    await inspectDurableObject(stub, async (_instance, state) => {
      const record = await state.storage.get<RoomRecord>("room");
      record!.disconnectedAt[player.playerId] = Date.now() - 60_001;
      await state.storage.put("room", record!);
    });
    const response = await socketTicket(room.code, player.playerId, player.resumeToken);
    expect(response.response.status).toBe(410);
    expect(response.body).toMatchObject({ error: "RECONNECT_EXPIRED" });
  });
});

describe("reports", () => {
  it("stores a finalized report and returns camelCase fields only to the owner", async () => {
    const { body: room } = await createRoom();
    await join(room.code, "리포트 학생");
    await request(`/api/teacher/rooms/${room.code}/start`, {
      method: "POST",
      headers: { "x-dev-teacher-email": TEACHER },
    });
    expect((await request(`/api/teacher/rooms/${room.code}/finish`, {
      method: "POST",
      headers: { "x-dev-teacher-email": TEACHER },
    })).status).toBe(200);

    const report = await request(`/api/teacher/reports/${room.code}`, {
      headers: { "x-dev-teacher-email": TEACHER },
    });
    expect(report.status).toBe(200);
    const body = await report.json<any>();
    expect(body).toMatchObject({
      room: { code: room.code, teacherEmail: TEACHER, participantCount: 1 },
      players: [{ nickname: "리포트 학생", rank: 1, roomCode: room.code }],
    });
    expect(body.room).not.toHaveProperty("teacher_email");
  });

  it("preserves two reports that reuse a six-digit code and returns the newest one", async () => {
    const code = "424242";
    const insertRoom = env.REPORTS.prepare(
      `INSERT INTO room_reports
        (room_id, code, teacher_email, grade, unit_key, duration_seconds, question_count,
         participant_count, started_at, finished_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    await env.REPORTS.batch([
      insertRoom.bind("old-room-id", code, TEACHER, "g1", "g1-l1-be-verb", 60, 5, 1, 100, 200, 50),
      insertRoom.bind("new-room-id", code, TEACHER, "g2", "g2-l1-give-verb", 180, 10, 1, 300, 500, 250),
      env.REPORTS.prepare(
        `INSERT INTO player_results
          (room_id, player_id, nickname, rank, score, accuracy, correct_count,
           answered_count, average_response_time_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind("old-room-id", "old-player", "예전 학생", 1, 100, 1, 1, 1, 500),
      env.REPORTS.prepare(
        `INSERT INTO player_results
          (room_id, player_id, nickname, rank, score, accuracy, correct_count,
           answered_count, average_response_time_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind("new-room-id", "new-player", "최근 학생", 1, 200, 1, 2, 2, 400),
    ]);

    const response = await request(`/api/teacher/reports/${code}`, {
      headers: { "x-dev-teacher-email": TEACHER },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      room: { code, grade: "g2", finishedAt: 500 },
      players: [{ playerId: "new-player", nickname: "최근 학생", roomCode: code }],
    });
    const count = await env.REPORTS.prepare(
      "SELECT COUNT(*) AS count FROM room_reports WHERE code = ?",
    ).bind(code).first<{ count: number }>();
    expect(count?.count).toBe(2);
  });
});
