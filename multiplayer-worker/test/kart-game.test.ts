import { describe, expect, it, vi } from "vitest";
import { advanceKart, createKart, KART_COURSE, rewardKart, steerKart, useKartItem } from "../src/kart-game";
import { createRoomState, joinPlayer, publicRoomState, startRoom, teacherRoomState, kartAction, settleKartRace, submitAnswer, type Question } from "../src/room-engine";

const startedAt = 1_000_000;
const question: Question = { id: "q1", kor: "나는 학생이다.", eng: "I ___ a student.", ans: "am", opts: ["am", "is", "are", "be"], level: 1 };

describe("grammar kart authoritative race", () => {
  it("makes steering around cones measurably faster than idling in the middle", () => {
    let idle = createKart(startedAt);
    let driver = createKart(startedAt);
    let time = startedAt;
    while ((!idle.finishedAt || !driver.finishedAt) && time < startedAt + 130_000) {
      time += 500;
      idle = advanceKart(idle, time);
      const next = KART_COURSE.find(event => event.kind === "hit" && event.at > driver.distance);
      const pad = next && KART_COURSE.find(event => event.kind === "pad" && event.at === next.at + 20);
      const desired = next && next.at - driver.distance < 75 && pad ? pad.lane : driver.lane;
      const lane = Math.max(driver.lane - .6, Math.min(driver.lane + .6, desired));
      driver = steerKart(driver, lane, driver.seq + 1, time);
    }
    expect(idle.finishedAt).toBeDefined();
    expect(driver.finishedAt).toBeDefined();
    expect(driver.hits).toBeLessThan(idle.hits);
    expect(driver.finishedAt!).toBeLessThan(idle.finishedAt!);
  });

  it("rejects forged lane jumps and duplicate packets, and only grants earned items", () => {
    const start = createKart(startedAt);
    expect(() => steerKart(start, .88, 1, startedAt + 100)).toThrow("INVALID_KART_MOVE");
    const moved = steerKart(start, .2, 1, startedAt + 500);
    expect(() => steerKart(moved, .2, 1, startedAt + 1000)).toThrow("INVALID_KART_MOVE");
    expect(() => useKartItem(moved, startedAt + 1100)).toThrow("KART_ITEM_NOT_READY");
    let earned = moved;
    for (let i = 0; i < 3; i++) earned = rewardKart(earned, true, startedAt + 1200 + i * 1000);
    const used = useKartItem(earned, startedAt + 4400);
    expect(used.charge).toBe(0);
    expect(used.boostUntil).toBeGreaterThan(startedAt + 4400);
    expect(used.shieldUntil).toBe(0);
    let recharged = used;
    for (let i = 0; i < 3; i++) recharged = rewardKart(recharged, true, startedAt + 4500 + i * 100);
    expect(() => useKartItem(recharged, startedAt + 4900)).toThrow("KART_ITEM_NOT_READY");
  });

  it("places a banana behind, slows the racer that crosses it, and fires a missile ahead", () => {
    const edgePickup = advanceKart({ ...createKart(startedAt), lane: -.88 }, startedAt + 20_000);
    expect(edgePickup.heldItem).toBe("banana");
    let room = createRoomState({ code: "654322", teacherEmail: "teacher@example.com", durationSeconds: 300,
      mode: "grammar_kart", playStyle: "individual", questions: [question], createdAt: startedAt - 1000 });
    room = joinPlayer(room, { id: "p0", nickname: "A", resumeTokenHash: "a", joinedAt: startedAt - 500 }).state;
    room = joinPlayer(room, { id: "p1", nickname: "B", resumeTokenHash: "b", joinedAt: startedAt - 500 }).state;
    room = startRoom(room, startedAt);
    room.players.p0.kart = { ...room.players.p0.kart!, distance: 100, heldItem: "banana" };
    room.players.p1.kart = { ...room.players.p1.kart!, distance: 88 };
    room = kartAction(room, { playerId: "p0", action: "weapon", serverNow: startedAt + 100 }).state;
    expect(room.players.p0.kart?.banana?.at).toBeGreaterThan(90);
    room = settleKartRace(room, startedAt + 1600);
    expect(room.players.p1.kart?.slipUntil).toBeGreaterThan(startedAt + 1600);
    expect(room.players.p0.kart?.banana).toBeUndefined();
    room.players.p0.kart = { ...room.players.p0.kart!, distance: 100, heldItem: "missile", itemReadyAt: 0 };
    room.players.p1.kart = { ...room.players.p1.kart!, distance: 145, slowUntil: 0, hitUntil: 0 };
    room = kartAction(room, { playerId: "p0", action: "weapon", serverNow: startedAt + 1700 }).state;
    expect(room.players.p1.kart?.slowUntil).toBeGreaterThan(startedAt + 1700);
  });

  it("shares all 30 server-ranked racers with the teacher and each student", () => {
    vi.useFakeTimers();
    vi.setSystemTime(startedAt + 1000);
    let room = createRoomState({ code: "654321", teacherEmail: "teacher@example.com", durationSeconds: 300,
      mode: "grammar_kart", playStyle: "individual", questions: [question], createdAt: startedAt - 1000 });
    for (let i = 0; i < 30; i++) room = joinPlayer(room, { id: `p${i}`, nickname: `학생${i + 1}`, resumeTokenHash: `h${i}`, joinedAt: startedAt - 500 }).state;
    room = startRoom(room, startedAt);
    room = kartAction(room, { playerId: "p0", action: "move", lane: 0, seq: 1, serverNow: startedAt + 1000 }).state;
    const current = publicRoomState(room, "p0");
    const teacher = teacherRoomState(room);
    expect(current.leaderboard).toHaveLength(30);
    expect(teacher.leaderboard).toHaveLength(30);
    expect(current.self?.kart?.distance).toBeGreaterThan(0);
    const q = current.self?.currentQuestion;
    expect(q).toBeDefined();
    room = submitAnswer(room, { playerId: "p0", questionId: q!.id, occurrenceIndex: q!.occurrenceIndex,
      answer: "am", serverNow: startedAt + 1500 }).state;
    expect(room.players.p0.kart?.charge).toBe(1);
    expect(room.players.p1.kart?.charge).toBe(0);
    vi.useRealTimers();
  });

  it("accepts only the supported design and color and publishes the choice", () => {
    const room = createRoomState({ code: "654323", teacherEmail: "teacher@example.com", durationSeconds: 300,
      mode: "grammar_kart", playStyle: "individual", questions: [question], createdAt: startedAt - 1000 });
    expect(() => joinPlayer(room, { id: "bad", nickname: "Bad", resumeTokenHash: "bad", joinedAt: startedAt,
      kartDesign: "unknown", kartColor: "pink" })).toThrow();
    const joined = joinPlayer(room, { id: "good", nickname: "Good", resumeTokenHash: "good", joinedAt: startedAt,
      kartDesign: "red", kartColor: "violet" }).state;
    expect(publicRoomState(joined, "good").self?.kart).toMatchObject({ design: "red", color: "violet" });
    expect(teacherRoomState(joined).leaderboard[0].kart).toMatchObject({ design: "red", color: "violet" });
  });
});
