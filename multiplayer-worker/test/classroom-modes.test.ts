import { describe, expect, it } from "vitest";

import {
  CLASSROOM_MODES,
  EngineError,
  createRoomState,
  joinPlayer,
  publicRoomState,
  startRoom,
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
      "boss_battle", "bubble_battle", "tower_race", "rangers_siege", "whack_race", "sentence_blast",
    ]);
    for (const mode of CLASSROOM_MODES) expect(makeRoom(mode).mode).toBe(mode);
  });

  it.each(CLASSROOM_MODES)("%s uses authoritative streak scoring and exposes the answer only in its answer result", (mode) => {
    let state = makeRoom(mode);
    const first = submit(state);
    state = first.state;
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
});
