import { describe, expect, it } from "vitest";

import {
  EngineError,
  createRoomState,
  joinPlayer,
  publicRoomState,
  startRoom,
  submitAnswer,
  teacherRoomState,
  type Question,
  type RoomState,
} from "../src/room-engine";

const QUESTIONS: Question[] = [
  {
    id: "g1-l1-q1",
    kor: "나는 학생이다.",
    eng: "I ___ a student.",
    ans: "am",
    opts: ["am", "is", "are", "be"],
    level: "basic",
  },
  {
    id: "g1-l1-q2",
    kor: "그녀는 친절하다.",
    eng: "She ___ kind.",
    ans: "is",
    opts: ["am", "is", "are", "be"],
    level: "basic",
  },
  {
    id: "g1-l1-q3",
    kor: "우리는 준비됐다.",
    eng: "We ___ ready.",
    ans: "are",
    opts: ["am", "is", "are", "be"],
    level: "basic",
  },
  {
    id: "g1-l1-q4",
    kor: "그것은 크다.",
    eng: "It ___ big.",
    ans: "is",
    opts: ["am", "is", "are", "be"],
    level: "basic",
  },
  {
    id: "g1-l1-q5",
    kor: "너는 늦었다.",
    eng: "You ___ late.",
    ans: "are",
    opts: ["am", "is", "are", "be"],
    level: "basic",
  },
  {
    id: "g1-l1-q6",
    kor: "나는 행복하다.",
    eng: "I ___ happy.",
    ans: "am",
    opts: ["am", "is", "are", "be"],
    level: "basic",
  },
  {
    id: "g1-l1-q7",
    kor: "그들은 여기 있다.",
    eng: "They ___ here.",
    ans: "are",
    opts: ["am", "is", "are", "be"],
    level: "basic",
  },
];

function room(): RoomState {
  return createRoomState({
    code: "123456",
    teacherEmail: "teacher@example.com",
    questions: QUESTIONS,
    createdAt: 1_000,
    durationSeconds: 300,
  });
}

function addPlayer(
  state: RoomState,
  id = "player-1",
  nickname = "  김   학생  ",
  joinedAt = 2_000,
): RoomState {
  return joinPlayer(state, {
    id,
    nickname,
    resumeTokenHash: `hash-${id}`,
    joinedAt,
  }).state;
}

function expectEngineCode(action: () => unknown, code: string) {
  try {
    action();
    throw new Error(`Expected EngineError ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(EngineError);
    expect((error as EngineError).code).toBe(code);
  }
}

function currentQuestion(state: RoomState, playerId: string): Question {
  const player = state.players[playerId];
  const questionId = player.questionOrder[player.questionIndex % player.questionOrder.length];
  const question = state.questions.find((candidate) => candidate.id === questionId);
  if (!question) throw new Error(`Missing current question for ${playerId}`);
  return question;
}

function submitCurrent(
  state: RoomState,
  playerId: string,
  serverNow: number,
  correct = true,
) {
  const question = currentQuestion(state, playerId);
  const answer = correct
    ? question.ans
    : question.opts.find((option) => option !== question.ans) ?? "";
  return submitAnswer(state, {
    playerId,
    questionId: question.id,
    occurrenceIndex: state.players[playerId].questionIndex,
    answer,
    serverNow,
  });
}

describe("room engine", () => {
  it("normalizes a nickname without mutating the previous room", () => {
    const original = room();
    const { state, player } = joinPlayer(original, {
      id: "player-1",
      nickname: "  김   학생  ",
      resumeTokenHash: "hash-1",
      joinedAt: 2_000,
    });

    expect(player.nickname).toBe("김 학생");
    expect(original.players).toEqual({});
    expect(state.players["player-1"].nickname).toBe("김 학생");
  });

  it("returns a detached joined player object", () => {
    const { state, player } = joinPlayer(room(), {
      id: "player-1",
      nickname: "원본",
      resumeTokenHash: "hash-1",
      joinedAt: 2_000,
    });

    player.nickname = "변경됨";
    player.questionOrder.reverse();
    player.optionOrders[QUESTIONS[0].id].reverse();

    expect(state.players["player-1"].nickname).toBe("원본");
    expect(state.players["player-1"].questionOrder).not.toEqual(player.questionOrder);
    expect(state.players["player-1"].optionOrders[QUESTIONS[0].id]).not.toEqual(
      player.optionOrders[QUESTIONS[0].id],
    );
  });

  it("accepts only the supported room durations", () => {
    for (const durationSeconds of [0, 30, 120, 301, Number.NaN, Number.POSITIVE_INFINITY]) {
      expectEngineCode(
        () =>
          createRoomState({
            code: "123456",
            teacherEmail: "teacher@example.com",
            questions: QUESTIONS,
            createdAt: 1_000,
            durationSeconds,
          }),
        "INVALID_ROOM",
      );
    }

    for (const durationSeconds of [60, 180, 300, 420, 600]) {
      expect(
        createRoomState({
          code: "123456",
          teacherEmail: "teacher@example.com",
          questions: QUESTIONS,
          createdAt: 1_000,
          durationSeconds,
        }).durationSeconds,
      ).toBe(durationSeconds);
    }
  });

  it("rejects a new player after the room starts", () => {
    const started = startRoom({ ...addPlayer(room()), allowLateJoin: false }, 3_000);

    expectEngineCode(
      () =>
        joinPlayer(started, {
          id: "late-player",
          nickname: "늦은 학생",
          resumeTokenHash: "hash-late",
          joinedAt: 4_000,
        }),
      "ROOM_STARTED",
    );
  });

  it("allows late join by default before the shared room deadline", () => {
    const waiting = createRoomState({
      code: "123456",
      teacherEmail: "teacher@example.com",
      questions: QUESTIONS,
      createdAt: 1_000,
      durationSeconds: 60,
    });
    expect(waiting.allowLateJoin).toBe(true);
    expect(waiting.shuffleQuestions).toBe(true);

    const started = startRoom(addPlayer(waiting), 3_000);
    const { state, player } = joinPlayer(started, {
      id: "late-player",
      nickname: "늦은 학생",
      resumeTokenHash: "hash-late",
      joinedAt: 62_999,
    });
    expect(state.status).toBe("playing");
    expect(player.questionStartedAt).toBe(62_999);

    expectEngineCode(
      () => joinPlayer(started, {
        id: "expired-player",
        nickname: "너무 늦은 학생",
        resumeTokenHash: "hash-expired",
        joinedAt: 63_000,
      }),
      "ROOM_STARTED",
    );
  });

  it("keeps question order stable when shuffleQuestions is false", () => {
    const stable = createRoomState({
      code: "123456",
      teacherEmail: "teacher@example.com",
      questions: QUESTIONS,
      createdAt: 1_000,
      durationSeconds: 300,
      shuffleQuestions: false,
    });
    const { player } = joinPlayer(stable, {
      id: "stable-player",
      nickname: "순서 학생",
      resumeTokenHash: "hash-stable",
      joinedAt: 2_000,
    });
    expect(player.questionOrder).toEqual(QUESTIONS.map((question) => question.id));
  });

  it("rejects invalid or pre-creation room start times", () => {
    const waiting = addPlayer(room());
    for (const startedAt of [999, Number.NaN, Number.POSITIVE_INFINITY]) {
      expectEngineCode(() => startRoom(waiting, startedAt), "INVALID_START_TIME");
    }
  });

  it("accepts only one submission per player and question", () => {
    const started = startRoom(addPlayer(room()), 3_000);
    const submittedQuestion = currentQuestion(started, "player-1");
    const first = submitCurrent(started, "player-1", 3_800);

    expect(first.result.correct).toBe(true);
    expectEngineCode(
      () =>
        submitAnswer(first.state, {
          playerId: "player-1",
          questionId: submittedQuestion.id,
          occurrenceIndex: 0,
          answer: submittedQuestion.ans,
          serverNow: 3_900,
        }),
      "DUPLICATE_ANSWER",
    );
  });

  it("repeats the question set as new occurrences until the deadline", () => {
    let state = createRoomState({
      code: "123456",
      teacherEmail: "teacher@example.com",
      questions: QUESTIONS.slice(0, 2),
      createdAt: 1_000,
      durationSeconds: 60,
      shuffleQuestions: false,
    });
    state = startRoom(addPlayer(state), 3_000);
    state = submitCurrent(state, "player-1", 4_000).state;
    state = submitCurrent(state, "player-1", 5_000).state;

    const repeatedView = publicRoomState(state, "player-1");
    expect(repeatedView.self?.currentQuestion).toMatchObject({
      id: QUESTIONS[0].id,
      occurrenceIndex: 2,
    });
    expect(repeatedView.self?.answeredQuestionIds).toEqual([]);

    const third = submitCurrent(state, "player-1", 6_000);
    expect(third.result).toMatchObject({ answeredCount: 3, score: 330 });
    expectEngineCode(
      () => submitAnswer(third.state, {
        playerId: "player-1",
        questionId: QUESTIONS[0].id,
        occurrenceIndex: 2,
        answer: QUESTIONS[0].ans,
        serverNow: 6_100,
      }),
      "DUPLICATE_ANSWER",
    );
    expectEngineCode(
      () => submitAnswer(third.state, {
        playerId: "player-1",
        questionId: QUESTIONS[1].id,
        occurrenceIndex: 3,
        answer: QUESTIONS[1].ans,
        serverNow: 63_000,
      }),
      "ROOM_EXPIRED",
    );
  });

  it("keeps answer detail bounded across many question occurrences", () => {
    let state = createRoomState({
      code: "123456",
      teacherEmail: "teacher@example.com",
      questions: QUESTIONS.slice(0, 2),
      createdAt: 1_000,
      durationSeconds: 600,
      shuffleQuestions: false,
    });
    state = startRoom(addPlayer(state), 3_000);

    for (let occurrenceIndex = 0; occurrenceIndex < 1_000; occurrenceIndex += 1) {
      state = submitCurrent(state, "player-1", 4_000 + occurrenceIndex).state;
    }

    const player = state.players["player-1"] as typeof state.players[string] & {
      answers?: unknown;
      lastAnswer?: {
        occurrenceIndex: number;
        questionId: string;
        correct: boolean;
        responseTimeMs: number;
        scoreGain: number;
        submittedAt: number;
      };
    };
    expect(player).not.toHaveProperty("answers");
    expect(player.lastAnswer).toMatchObject({
      occurrenceIndex: 999,
      questionId: QUESTIONS[1].id,
      correct: true,
    });
    expect(Object.keys(player.lastAnswer ?? {})).toHaveLength(6);
    expect(player).toMatchObject({
      answered: 1_000,
      correct: 1_000,
      questionIndex: 1_000,
      score: 149_850,
    });

    for (const occurrenceIndex of [999, 0]) {
      const question = QUESTIONS[occurrenceIndex % 2];
      expectEngineCode(
        () => submitAnswer(state, {
          playerId: "player-1",
          questionId: question.id,
          occurrenceIndex,
          answer: question.ans,
          serverNow: 6_000,
        }),
        "DUPLICATE_ANSWER",
      );
    }
  });

  it("scores a correct streak from 100 to a 150 point cap and resets it on a wrong answer", () => {
    let state = startRoom(addPlayer(room()), 3_000);
    const gains: number[] = [];

    for (let index = 0; index < 6; index += 1) {
      const submitted = submitCurrent(state, "player-1", 3_500 + index * 500);
      state = submitted.state;
      gains.push(submitted.result.scoreGain);
    }

    expect(gains).toEqual([100, 110, 120, 130, 140, 150]);
    expect(state.players["player-1"].score).toBe(750);

    const wrong = submitCurrent(state, "player-1", 6_700, false);

    expect(wrong.result).toMatchObject({ correct: false, scoreGain: 0, streak: 0 });
    expect(wrong.state.players["player-1"].score).toBe(750);
  });

  it("validates the player and submitted option", () => {
    const started = startRoom(addPlayer(room()), 3_000);
    const question = currentQuestion(started, "player-1");

    expectEngineCode(
      () =>
        submitAnswer(started, {
          playerId: "missing",
          questionId: question.id,
          occurrenceIndex: 0,
          answer: question.ans,
          serverNow: 3_500,
        }),
      "UNKNOWN_PLAYER",
    );
    expectEngineCode(
      () =>
        submitAnswer(started, {
          playerId: "player-1",
          questionId: question.id,
          occurrenceIndex: 0,
          answer: "definitely-not-an-option",
          serverNow: 3_500,
        }),
      "INVALID_ANSWER",
    );
  });

  it("rejects invalid server times and submissions at or after the room deadline", () => {
    const started = startRoom(addPlayer(room()), 3_000);
    const question = currentQuestion(started, "player-1");

    for (const serverNow of [-1, 2_999, Number.NaN, Number.POSITIVE_INFINITY]) {
      expectEngineCode(
        () =>
          submitAnswer(started, {
            playerId: "player-1",
            questionId: question.id,
            occurrenceIndex: 0,
            answer: question.ans,
            serverNow,
          }),
        "INVALID_SUBMISSION_TIME",
      );
    }

    expectEngineCode(
      () =>
        submitAnswer(started, {
          playerId: "player-1",
          questionId: question.id,
          occurrenceIndex: 0,
          answer: question.ans,
          serverNow: 303_000,
        }),
      "ROOM_EXPIRED",
    );
  });

  it("rejects a forged question that is not the player's current ordered question", () => {
    const started = startRoom(addPlayer(room()), 3_000);
    const current = currentQuestion(started, "player-1");
    const forged = QUESTIONS.find((question) => question.id !== current.id)!;

    expectEngineCode(
      () =>
        submitAnswer(started, {
          playerId: "player-1",
          questionId: forged.id,
          occurrenceIndex: 0,
          answer: forged.ans,
          serverNow: 3_500,
        }),
      "NOT_CURRENT_QUESTION",
    );
  });

  it("sorts ties by score, accuracy, correct count, then average response time", () => {
    let state = room();
    state = addPlayer(state, "accurate", "정확이", 2_000);
    state = addPlayer(state, "fast", "빠름이", 2_100);
    state = addPlayer(state, "slow", "느림이", 2_200);
    state = startRoom(state, 3_000);

    // All three finish on 100 points. Accurate answered one of one,
    // while Fast and Slow answered one of two. Fast wins the final tie breaker.
    state = submitCurrent(state, "accurate", 3_900).state;
    for (const [playerId, responseTimeMs] of [
      ["fast", 500],
      ["slow", 1_000],
    ] as const) {
      state = submitCurrent(state, playerId, 3_000 + responseTimeMs).state;
      state = submitCurrent(state, playerId, 3_000 + responseTimeMs * 2, false).state;
    }

    const ranking = teacherRoomState(state).leaderboard;
    expect(ranking.map((entry) => entry.playerId)).toEqual([
      "accurate",
      "fast",
      "slow",
    ]);
  });

  it("uses correct count before average response time for otherwise tied players", () => {
    let state = room();
    state = addPlayer(state, "fewer", "적게 맞힘", 2_000);
    state = addPlayer(state, "more", "더 맞힘", 2_100);
    state = {
      ...state,
      players: {
        ...state.players,
        fewer: {
          ...state.players.fewer,
          score: 1_100,
          correct: 5,
          answered: 10,
          responseTimeTotalMs: 1_000,
        },
        more: {
          ...state.players.more,
          score: 1_100,
          correct: 6,
          answered: 12,
          responseTimeTotalMs: 24_000,
        },
      },
    };

    expect(teacherRoomState(state).leaderboard.map((entry) => entry.playerId)).toEqual([
      "more",
      "fewer",
    ]);
  });

  it("keeps other students' accuracy and response time out of public state", () => {
    let state = room();
    state = addPlayer(state, "player-1", "하나", 2_000);
    state = addPlayer(state, "player-2", "둘", 2_100);
    state = startRoom(state, 3_000);
    state = submitCurrent(state, "player-1", 3_650).state;
    state = submitCurrent(state, "player-2", 4_200, false).state;

    const studentView = publicRoomState(state, "player-1");
    expect(studentView.self).toMatchObject({
      playerId: "player-1",
      accuracy: 1,
      averageResponseTimeMs: 650,
    });
    expect(studentView.leaderboard[0]).not.toHaveProperty("accuracy");
    expect(studentView.leaderboard[0]).not.toHaveProperty("averageResponseTimeMs");
    expect(JSON.stringify(studentView.leaderboard)).not.toContain("answered");
    expect(studentView.leaderboard.every((entry) => !("playerId" in entry))).toBe(true);
    expect(studentView.self).not.toHaveProperty("questions");
    expect(studentView.self?.currentQuestion).not.toHaveProperty("ans");
  });

  it("shows a student only their neighboring ranks and no peer identifiers", () => {
    let state = room();
    for (let index = 1; index <= 5; index += 1) {
      state = addPlayer(state, `player-${index}`, `학생${index}`, 2_000 + index);
    }
    state = {
      ...state,
      players: Object.fromEntries(
        Object.entries(state.players).map(([id, player], index) => [
          id,
          { ...player, score: (5 - index) * 100 },
        ]),
      ),
    };

    const view = publicRoomState(state, "player-3");
    expect(view.leaderboard.map((entry) => entry.rank)).toEqual([2, 3, 4]);
    expect(view.leaderboard.map((entry) => entry.nickname)).toEqual([
      "학생2",
      "학생3",
      "학생4",
    ]);
    expect(view.leaderboard.every((entry) => !("playerId" in entry))).toBe(true);

    const lobbyView = publicRoomState(state);
    expect(lobbyView.leaderboard).toHaveLength(5);
    expect(lobbyView.leaderboard[0]).toEqual({
      rank: 1,
      nickname: "학생1",
      score: 500,
      isSelf: false,
    });
  });
});
