import { describe, expect, it } from "vitest";

import {
  CLASSROOM_MODES,
  SPACE_OUTCOME_WEIGHTS,
  EngineError,
  createRoomState,
  joinPlayer,
  publicRoomState,
  startRoom,
  spaceAction,
  submitAnswer,
  teacherRoomState,
  type Question,
  type RoomMode,
  type RoomState,
} from "../src/room-engine";

const QUESTIONS: Question[] = [
  { id: "q1", kor: "나는 학생이다.", eng: "I ___ a student.", ans: "am", opts: ["am", "is", "are"], level: 1 },
  { id: "q2", kor: "그녀는 친절하다.", eng: "She ___ kind.", ans: "is", opts: ["am", "is", "are"], level: 1 },
];

function makeRoom(mode: RoomMode): RoomState {
  let state = createRoomState({
    code: "654321",
    teacherEmail: "teacher@example.com",
    questions: QUESTIONS,
    createdAt: 1_000,
    durationSeconds: 60,
    shuffleQuestions: false,
    mode,
  });
  state = joinPlayer(state, { id: "p1", nickname: "하나", resumeTokenHash: "hash-p1", joinedAt: 2_000 }).state;
  state = joinPlayer(state, { id: "p2", nickname: "둘", resumeTokenHash: "hash-p2", joinedAt: 2_100 }).state;
  return startRoom(state, 3_000);
}

function submit(state: RoomState, overrides: Partial<Parameters<typeof submitAnswer>[1]> = {}) {
  const player = state.players.p1;
  const questionId = player.questionOrder[player.questionIndex % player.questionOrder.length];
  const question = state.questions.find((entry) => entry.id === questionId)!;
  return submitAnswer(state, {
    playerId: "p1",
    questionId,
    occurrenceIndex: player.questionIndex,
    answer: question.ans,
    serverNow: player.questionStartedAt! + 500,
    ...overrides,
  });
}

function expectCode(action: () => unknown, code: string) {
  try {
    action();
    throw new Error(`Expected EngineError ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(EngineError);
    expect((error as EngineError).code).toBe(code);
  }
}

describe("classroom game modes", () => {
  it("creates every classroom mode without changing its mode identity", () => {
    expect(CLASSROOM_MODES).toEqual([
      "boss_battle", "bubble_battle", "tower_race", "rangers_siege", "whack_race", "sentence_blast", "space_raiders",
    ]);
    for (const mode of CLASSROOM_MODES) expect(makeRoom(mode).mode).toBe(mode);
  });

  it.each(CLASSROOM_MODES)("%s uses authoritative streak scoring and exposes the answer only in its answer result", (mode) => {
    let state = makeRoom(mode);
    const first = submit(state);
    state = first.state;
    if (mode === "space_raiders") {
      const pending = state.players.p1.space!.pendingPlanets![0];
      state = spaceAction(state, { playerId: "p1", action: "choose_planet", seq: state.players.p1.space!.seq, planetId: pending.id, serverNow: 3_600 }).state;
      if (state.players.p1.space?.pendingEffect) {
        state = spaceAction(state, { playerId: "p1", action: "resolve_effect", seq: state.players.p1.space.seq, targetPlayerId: "p2", serverNow: 3_700 }).state;
      }
    }
    const second = submit(state);

    expect(first.result).toMatchObject({ correct: true, correctAnswer: "am", scoreGain: 100, score: 100, streak: 1 });
    expect(second.result).toMatchObject({ correct: true, correctAnswer: "is", scoreGain: 110, score: 210, streak: 2 });
  });

  it.each(CLASSROOM_MODES)("%s accepts an empty timeout as a scored wrong answer", (mode) => {
    const timedOut = submit(makeRoom(mode), { answer: "" });
    expect(timedOut.result).toMatchObject({ correct: false, correctAnswer: "am", scoreGain: 0, score: 0, streak: 0, answeredCount: 1 });
    expect(timedOut.state.players.p1).toMatchObject({ answered: 1, correct: 0, questionIndex: 1 });
  });

  it.each(["score_race", "treasure_heist", "maze_heist", "grammar_escape"] as const)(
    "%s rejects the classroom-only empty timeout",
    (mode) => expectCode(() => submit(makeRoom(mode), { answer: "" }), "INVALID_ANSWER"),
  );

  it("does not leak unsolved answer keys through student or teacher room views", () => {
    const state = makeRoom("boss_battle");
    const studentJson = JSON.stringify(publicRoomState(state, "p1"));
    const teacherJson = JSON.stringify(teacherRoomState(state));

    expect(studentJson).not.toContain('"ans"');
    expect(studentJson).not.toContain("correctAnswer");
    expect(teacherJson).not.toContain('"ans"');
    expect(teacherJson).not.toContain("correctAnswer");
  });

  it("keeps lastAnswer and correctAnswer private to the player who submitted it", () => {
    const answered = submit(makeRoom("tower_race"));
    const ownView = publicRoomState(answered.state, "p1");
    const peerView = publicRoomState(answered.state, "p2");
    const teacherView = teacherRoomState(answered.state);

    expect(ownView.self?.lastAnswer).toMatchObject({ questionId: "q1", occurrenceIndex: 0, correct: true, correctAnswer: "am" });
    expect(peerView.self).not.toHaveProperty("lastAnswer");
    expect(JSON.stringify(peerView)).not.toContain("correctAnswer");
    expect(JSON.stringify(teacherView)).not.toContain("correctAnswer");
    expect(ownView.leaderboard.every((entry) => !("correctAnswer" in entry))).toBe(true);
  });

  it("rejects duplicate, future/stale-question, and deadline submissions", () => {
    const started = makeRoom("sentence_blast");
    const accepted = submit(started);

    expectCode(() => submit(accepted.state, {
      questionId: "q1", occurrenceIndex: 0, answer: "am", serverNow: 3_600,
    }), "DUPLICATE_ANSWER");
    expectCode(() => submit(started, {
      questionId: "q2", occurrenceIndex: 1, answer: "is", serverNow: 3_500,
    }), "NOT_CURRENT_QUESTION");
    expectCode(() => submit(started, {
      questionId: "q2", occurrenceIndex: 0, answer: "is", serverNow: 3_500,
    }), "NOT_CURRENT_QUESTION");
    expectCode(() => submit(started, { serverNow: 63_000 }), "ROOM_EXPIRED");
  });

  it("does not add correctAnswer to legacy mode answer results", () => {
    expect(submit(makeRoom("score_race")).result).not.toHaveProperty("correctAnswer");
  });

  it("creates hidden planet choices after a correct answer and reveals them only on selection", () => {
    const answered = submit(makeRoom("space_raiders"));
    const space = answered.state.players.p1.space!;
    expect(space.pendingPlanets).toHaveLength(3);
    expect(JSON.stringify(space.pendingPlanets)).not.toContain("steal");
    const chosen = spaceAction(answered.state, {
      playerId: "p1", action: "choose_planet", seq: space.seq, planetId: space.pendingPlanets![0].id, serverNow: 3_600,
    });
    expect(chosen.result.kind).toMatch(/energy|shield|double|triple|angel|steal|swap|bomb/);
    expect(space.pendingPlanets?.map((planet) => planet.strategy)).toEqual(["safe", "risky", "safe"]);
    expect(chosen.state.players.p1.space?.pendingPlanets).toBeUndefined();
  });

  it("keeps the safe and risky outcome table centralized and balanced", () => {
    expect(Object.values(SPACE_OUTCOME_WEIGHTS.safe).reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(Object.values(SPACE_OUTCOME_WEIGHTS.risky).reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(SPACE_OUTCOME_WEIGHTS.safe.bomb).toBe(0);
    expect(SPACE_OUTCOME_WEIGHTS.risky.bomb).toBe(2);
  });

  it("applies steal and swap targets on the server exactly once", () => {
    const base = makeRoom("space_raiders");
    const withSteal = { ...base, players: { ...base.players, p1: { ...base.players.p1, space: { energy: 10, seq: 2, exploredPlanetIds: ["old"], pendingEffect: { kind: "steal" as const, amount: 60, planetId: "old" } }, }, p2: { ...base.players.p2, space: { energy: 100, seq: 0, exploredPlanetIds: [] } } } };
    const stolen = spaceAction(withSteal, { playerId: "p1", action: "resolve_effect", seq: 2, targetPlayerId: "p2", serverNow: 3_600 });
    expect(stolen.state.players.p1.space?.energy).toBe(70);
    expect(stolen.state.players.p2.space?.energy).toBe(40);
    expectCode(() => spaceAction(stolen.state, { playerId: "p1", action: "resolve_effect", seq: 2, targetPlayerId: "p2", serverNow: 3_700 }), "DUPLICATE_SPACE_ACTION");

    const withSwap = { ...base, players: { ...base.players, p1: { ...base.players.p1, space: { energy: 15, seq: 3, exploredPlanetIds: [], pendingEffect: { kind: "swap" as const, planetId: "swap" } }, }, p2: { ...base.players.p2, space: { energy: 95, seq: 0, exploredPlanetIds: [] } } } };
    const swapped = spaceAction(withSwap, { playerId: "p1", action: "resolve_effect", seq: 3, targetPlayerId: "p2", serverNow: 3_600 });
    expect(swapped.state.players.p1.space?.energy).toBe(95);
    expect(swapped.state.players.p2.space?.energy).toBe(15);
  });

  it("consumes a shield when it blocks a steal and leaves both balances safe", () => {
    const base = makeRoom("space_raiders");
    const withShield = { ...base, players: {
      ...base.players,
      p1: { ...base.players.p1, space: { energy: 10, shield: 0, explorationStreak: 0, seq: 2, exploredPlanetIds: [], pendingEffect: { kind: "steal" as const, amount: 60, planetId: "old" } } },
      p2: { ...base.players.p2, space: { energy: 100, shield: 1, explorationStreak: 0, seq: 0, exploredPlanetIds: [] } },
    } };
    const blocked = spaceAction(withShield, { playerId: "p1", action: "resolve_effect", seq: 2, targetPlayerId: "p2", serverNow: 3_600 });
    expect(blocked.result.event.message).toContain("막았어요");
    expect(blocked.state.players.p1.space?.energy).toBe(10);
    expect(blocked.state.players.p2.space?.energy).toBe(100);
    expect(blocked.state.players.p2.space?.shield).toBe(0);
  });

  it("gifts an angel bonus without charging the sender and rejects self targets", () => {
    const base = makeRoom("space_raiders");
    const withAngel = { ...base, players: {
      ...base.players,
      p1: { ...base.players.p1, space: { energy: 40, shield: 0, explorationStreak: 0, seq: 2, exploredPlanetIds: [], pendingEffect: { kind: "angel" as const, amount: 80, planetId: "old" } } },
      p2: { ...base.players.p2, space: { energy: 20, shield: 0, explorationStreak: 0, seq: 0, exploredPlanetIds: [] } },
    } };
    expectCode(() => spaceAction(withAngel, { playerId: "p1", action: "resolve_effect", seq: 2, targetPlayerId: "p1", serverNow: 3_600 }), "SPACE_NOT_AVAILABLE");
    const gifted = spaceAction(withAngel, { playerId: "p1", action: "resolve_effect", seq: 2, targetPlayerId: "p2", serverNow: 3_600 });
    expect(gifted.state.players.p1.space?.energy).toBe(40);
    expect(gifted.state.players.p2.space?.energy).toBe(100);
    expectCode(() => spaceAction(gifted.state, { playerId: "p1", action: "resolve_effect", seq: 2, targetPlayerId: "p2", serverNow: 3_700 }), "DUPLICATE_SPACE_ACTION");
  });

  it("resets only the actor on a rare risky bomb and keeps the shield", () => {
    const base = makeRoom("space_raiders");
    let bomb;
    for (let index = 0; index < 200 && !bomb; index += 1) {
      const state = { ...base, players: {
        ...base.players,
        p1: { ...base.players.p1, space: { energy: 240, shield: 1, explorationStreak: 2, seq: 0, exploredPlanetIds: [], pendingPlanets: [{ id: `planet:${index}:violet`, label: "위험", color: "violet" as const, strategy: "risky" as const }] } },
      } };
      const result = spaceAction(state, { playerId: "p1", action: "choose_planet", seq: 0, planetId: `planet:${index}:violet`, serverNow: 3_600 });
      if (result.result.kind === "bomb") bomb = result;
    }
    expect(bomb?.result.kind).toBe("bomb");
    expect(bomb?.state.players.p1.space?.energy).toBe(0);
    expect(bomb?.state.players.p1.space?.shield).toBe(1);
    expect(bomb?.state.players.p2.space?.energy).toBe(0);
    expect(bomb?.state.players.p1.space?.pendingPlanets).toBeUndefined();
    expect(() => submit(bomb!.state)).not.toThrow();
  });
});
