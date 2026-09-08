import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../src/index";
import type { Env, RoomRecord } from "../src/types";

const TEACHER = "teacher@example.com";
const inspect = runInDurableObject as unknown as (
  stub: DurableObjectStub,
  callback: (instance: { alarm(): Promise<void> }, state: DurableObjectState) => Promise<void>,
) => Promise<void>;

function request(path: string, init: RequestInit = {}) {
  return worker.fetch(new Request(`http://127.0.0.1${path}`, init), env as Env);
}

async function initializeSessionRoom(code: string) {
  const stub = env.ROOMS.getByName(code);
  const response = await stub.fetch("https://room/internal/initialize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      roomId: crypto.randomUUID(), code, teacherEmail: TEACHER, grade: "g1", unitKey: "g1-l1-be-verb",
      durationSeconds: 60, allowLateJoin: true, shuffleQuestions: false, mode: "score_race",
      playStyle: "individual", questions: [{ id: "q1", eng: "I ___ ready.", kor: "알맞은 말을 고르세요.", opts: ["am", "is"], ans: "am" }],
      createdAt: Date.now(), studentRecordRetention: "session",
    }),
  });
  expect(response.status).toBe(201);
  return stub;
}

beforeEach(async () => {
  await env.REPORTS.exec("DELETE FROM player_results; DELETE FROM room_reports;");
});

describe("session-only student records", () => {
  it("keeps a finished result in the owned room but never writes it to D1", async () => {
    const code = String(700000 + Math.floor(Math.random() * 200000));
    const stub = await initializeSessionRoom(code);
    const joined = await stub.fetch("https://room/internal/join", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nickname: "임시 학생" }),
    });
    const player = await joined.json<{ playerId: string; resumeToken: string }>();
    await stub.fetch("https://room/internal/start", { method: "POST", headers: { "x-room-teacher-email": TEACHER } });
    await stub.fetch("https://room/internal/finish", { method: "POST", headers: { "x-room-teacher-email": TEACHER } });

    const counts = await env.REPORTS.prepare(
      "SELECT (SELECT COUNT(*) FROM room_reports) AS rooms, (SELECT COUNT(*) FROM player_results) AS players",
    ).first<{ rooms: number; players: number }>();
    expect(counts).toEqual({ rooms: 0, players: 0 });

    const report = await request(`/api/teacher/reports/${code}`, { headers: { "x-dev-teacher-email": TEACHER } });
    expect(report.status).toBe(200);
    expect(await report.json()).toMatchObject({
      room: { code, teacherEmail: TEACHER, participantCount: 1, studentRecordRetention: "session", resultExpiresAt: expect.any(Number) },
      players: [{ nickname: "임시 학생", rank: 1, roomCode: code }],
    });

    const student = await stub.fetch(`https://room/internal/state?playerId=${player.playerId}`, {
      headers: { "x-resume-token": player.resumeToken },
    });
    expect(student.status).toBe(200);
    expect(await student.json()).toMatchObject({
      status: "finished", self: { nickname: "임시 학생" }, studentRecordRetention: "session", resultExpiresAt: expect.any(Number),
    });
  });

  it("deletes finished session rooms after 30 minutes and unfinished lobbies after two hours", async () => {
    const finishedCode = String(700000 + Math.floor(Math.random() * 100000));
    const finished = await initializeSessionRoom(finishedCode);
    await finished.fetch("https://room/internal/start", { method: "POST", headers: { "x-room-teacher-email": TEACHER } });
    await finished.fetch("https://room/internal/finish", { method: "POST", headers: { "x-room-teacher-email": TEACHER } });
    await inspect(finished, async (_instance, state) => {
      const record = await state.storage.get<RoomRecord>("room");
      record!.state.finishedAt = Date.now() - 30 * 60_000 - 1;
      await state.storage.put("room", record!);
    });
    const expiredReport = await request(`/api/teacher/reports/${finishedCode}`, { headers: { "x-dev-teacher-email": TEACHER } });
    expect(expiredReport.status).toBe(404);
    await inspect(finished, async (_instance, state) => {
      expect(await state.storage.get("room")).toBeUndefined();
    });

    const lobbyCode = String(800000 + Math.floor(Math.random() * 100000));
    const lobby = await initializeSessionRoom(lobbyCode);
    await inspect(lobby, async (_instance, state) => {
      const record = await state.storage.get<RoomRecord>("room");
      record!.state.createdAt = Date.now() - 2 * 60 * 60_000 - 1;
      await state.storage.put("room", record!);
    });
    const expiredLobby = await lobby.fetch("https://room/internal/state");
    expect(expiredLobby.status).toBe(404);
    await inspect(lobby, async (_instance, state) => {
      expect(await state.storage.get("room")).toBeUndefined();
    });
  });
});
