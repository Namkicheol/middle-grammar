import { runInDurableObject } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

let roomCode = "654321";
const TEACHER = "teacher@example.com";
const QUESTION = {
  id: "teacher-socket-q1",
  kor: "그는 학생이다.",
  eng: "He ___ a student.",
  ans: "is",
  opts: ["is", "are"],
  level: 1,
  type: "mcq",
};

const inspectDurableObject = runInDurableObject as unknown as (
  stub: DurableObjectStub,
  callback: (instance: unknown, state: DurableObjectState) => Promise<void>,
) => Promise<void>;

function stub() {
  return env.ROOMS.getByName(roomCode);
}

async function direct(path: string, init: RequestInit = {}) {
  return stub().fetch(`https://room${path}`, init);
}

async function seedSession(email: string, hash: string, expiresAt: number) {
  const now = Date.now();
  await env.REPORTS.prepare(
    "INSERT OR IGNORE INTO teacher_identities (google_sub, email, created_at, updated_at) VALUES (?, ?, ?, ?)",
  ).bind(`sub-${email}`, email, now, now).run();
  await env.REPORTS.prepare(
    "INSERT OR REPLACE INTO teacher_sessions (session_hash, google_sub, email, csrf_hash, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, NULL)",
  ).bind(hash, `sub-${email}`, email, `csrf-${email}`, now, expiresAt).run();
}

async function initializeRoom() {
  const response = await direct("/internal/initialize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      roomId: crypto.randomUUID(),
      code: roomCode,
      teacherEmail: TEACHER,
      grade: "g1",
      unitKey: "g1-l1-be-verb",
      durationSeconds: 300,
      allowLateJoin: true,
      shuffleQuestions: false,
      questions: [QUESTION],
      createdAt: Date.now(),
    }),
  });
  expect(response.status).toBe(201);
}

async function openTeacher(hash: string, expiresAt: number) {
  return direct("/internal/ws", {
    headers: {
      upgrade: "websocket",
      "x-room-teacher-email": TEACHER,
      "x-room-teacher-session-hash": hash,
      "x-room-teacher-session-expires": String(expiresAt),
    },
  });
}

async function openStudent() {
  const joined = await direct("/internal/join", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nickname: "학생" }),
  });
  const joinedBody = await joined.json<any>();
  const ticketResponse = await direct("/internal/socket-ticket", {
    method: "POST",
    headers: { "x-resume-token": joinedBody.resumeToken, "content-type": "application/json" },
    body: JSON.stringify({ playerId: joinedBody.playerId }),
  });
  const ticketBody = await ticketResponse.json<any>();
  return direct(`/internal/ws?ticket=${encodeURIComponent(ticketBody.ticket)}`, {
    headers: { upgrade: "websocket" },
  });
}

async function nextMessage(socket: WebSocket) {
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WebSocket message timed out")), 1_000);
    socket.addEventListener("message", (event) => {
      clearTimeout(timer);
      resolve(JSON.parse(String(event.data)));
    }, { once: true });
  });
}

beforeEach(async () => {
  roomCode = String(650000 + Math.floor(Math.random() * 30000));
  await env.REPORTS.exec("DELETE FROM teacher_session_rooms; DELETE FROM teacher_sessions; DELETE FROM teacher_identities;");
});

describe("teacher WebSocket session enforcement", () => {
  it("rejects missing and expired session hashes, and opens a valid session", async () => {
    await initializeRoom();
    const validHash = "hash-valid-teacher";
    const validExpiry = Date.now() + 60_000;
    await seedSession(TEACHER, validHash, validExpiry);

    const missing = await direct("/internal/ws", {
      headers: { upgrade: "websocket", "x-room-teacher-email": TEACHER },
    });
    expect(missing.status).toBe(401);

    const expiredHash = "hash-expired-teacher";
    await seedSession(TEACHER, expiredHash, Date.now() - 1);
    const expired = await openTeacher(expiredHash, Date.now() - 1);
    expect(expired.status).toBe(401);

    const opened = await openTeacher(validHash, validExpiry);
    expect(opened.status).toBe(101);
    const socket = opened.webSocket!;
    socket.accept();
    await expect(nextMessage(socket)).resolves.toMatchObject({ type: "hello", state: { code: roomCode } });
    socket.close(1000, "test complete");
  });

  it("revokes only the targeted teacher session and leaves student/other session sockets open", async () => {
    await initializeRoom();
    const firstHash = "hash-first-teacher";
    const secondHash = "hash-second-teacher";
    const expiry = Date.now() + 600_000;
    await seedSession(TEACHER, firstHash, expiry);
    await seedSession(TEACHER, secondHash, expiry);

    const firstResponse = await openTeacher(firstHash, expiry);
    const secondResponse = await openTeacher(secondHash, expiry);
    const studentResponse = await openStudent();
    expect(firstResponse.status).toBe(101);
    expect(secondResponse.status).toBe(101);
    expect(studentResponse.status).toBe(101);
    const first = firstResponse.webSocket!;
    const second = secondResponse.webSocket!;
    const student = studentResponse.webSocket!;
    first.accept();
    second.accept();
    student.accept();
    await nextMessage(first);
    await nextMessage(second);
    await nextMessage(student);

    const revoked = await direct("/internal/revoke-teacher-session", {
      method: "POST",
      headers: { "x-room-teacher-session-hash": firstHash },
    });
    expect(revoked.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(first.readyState).not.toBe(WebSocket.OPEN);
    expect(second.readyState).toBe(WebSocket.OPEN);
    expect(student.readyState).toBe(WebSocket.OPEN);

    second.close(1000, "test complete");
    student.close(1000, "test complete");
  });

  it("does not broadcast a room update to a revoked teacher session", async () => {
    await initializeRoom();
    const hash = "hash-revoked-teacher";
    const expiry = Date.now() + 60_000;
    await seedSession(TEACHER, hash, expiry);
    const response = await openTeacher(hash, expiry);
    expect(response.status).toBe(101);
    const socket = response.webSocket!;
    socket.accept();
    await nextMessage(socket);

    await env.REPORTS.prepare("UPDATE teacher_sessions SET revoked_at = ? WHERE session_hash = ?")
      .bind(Date.now(), hash).run();
    const messages: unknown[] = [];
    socket.addEventListener("message", (event) => messages.push(event.data));
    await direct("/internal/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname: "학생" }),
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(messages).toHaveLength(0);
  });
});

describe("teacher socket alarms", () => {
  it("closes expired teacher sockets without replacing the room game-end alarm", async () => {
    await initializeRoom();
    const hash = "hash-alarm-teacher";
    const expiry = Date.now() + 600_000;
    await seedSession(TEACHER, hash, expiry);
    const response = await openTeacher(hash, expiry);
    expect(response.status).toBe(101);
    response.webSocket!.accept();
    await nextMessage(response.webSocket!);

    const started = await direct("/internal/start", {
      method: "POST",
      headers: { "x-room-teacher-email": TEACHER },
    });
    expect(started.status).toBe(200);
    await inspectDurableObject(stub(), async (instance, state) => {
      await env.REPORTS.prepare("UPDATE teacher_sessions SET expires_at = ? WHERE session_hash = ?").bind(Date.now() - 1, hash).run();
      const roomEnd = await state.storage.getAlarm();
      expect(roomEnd).toEqual(expect.any(Number));
      await (instance as { alarm(): Promise<void> }).alarm();
      expect(await state.storage.getAlarm()).toBe(roomEnd);
    });
  });
});
