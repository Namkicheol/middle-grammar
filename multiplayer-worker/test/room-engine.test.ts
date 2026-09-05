import { describe, expect, it } from "vitest";

import {
  EngineError,
  chooseTreasure,
  createRoomState,
  joinPlayer,
  mazeMove,
  publicRoomState,
  startRoom,
  submitAnswer,
  teacherRoomState,
  TREASURE_LOOT_AMOUNT,
  TREASURE_SAFE_BONUS,
  MAZE_MOVE_FAST_THRESHOLD_MS,
  MAZE_PAIR_COOLDOWN_MS,
  MAZE_SPAWN_PROTECTION_MS,
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

function heistRoom(): RoomState {
  return createRoomState({
    code: "123456",
    teacherEmail: "teacher@example.com",
    questions: QUESTIONS,
    createdAt: 1_000,
    durationSeconds: 300,
    shuffleQuestions: false,
    mode: "treasure_heist",
  });
}

function mazeRoom(): RoomState {
  return createRoomState({
    code: "123456",
    teacherEmail: "teacher@example.com",
    questions: QUESTIONS,
    createdAt: 1_000,
    durationSeconds: 300,
    shuffleQuestions: false,
    mode: "maze_heist",
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

  it("defaults existing rooms to score_race and accepts treasure_heist", () => {
    expect(room().mode).toBe("score_race");
    expect(heistRoom().mode).toBe("treasure_heist");
  });

  it("defaults to individual play and validates team settings", () => {
    expect(room().playStyle).toBe("individual");
    expect(room().teamCount).toBeUndefined();
    for (const teamCount of [undefined, 1, 5, 2.5, Number.NaN]) {
      expectEngineCode(() => createRoomState({
        code: "123456",
        teacherEmail: "teacher@example.com",
        questions: QUESTIONS,
        createdAt: 1_000,
        durationSeconds: 300,
        playStyle: "team",
        teamCount,
      }), "INVALID_ROOM");
    }
    expectEngineCode(() => createRoomState({
      code: "123456",
      teacherEmail: "teacher@example.com",
      questions: QUESTIONS,
      createdAt: 1_000,
      durationSeconds: 300,
      teamCount: 2,
    }), "INVALID_ROOM");
  });

  it("auto-balances team assignments and keeps them stable through reconnect views", () => {
    let state = createRoomState({
      code: "123456",
      teacherEmail: "teacher@example.com",
      questions: QUESTIONS,
      createdAt: 1_000,
      durationSeconds: 300,
      playStyle: "team",
      teamCount: 3,
    });
    for (let index = 1; index <= 8; index += 1) {
      state = addPlayer(state, `team-player-${index}`, `팀 학생${index}`, 2_000 + index);
    }
    const assignments = Object.values(state.players).map((player) => player.teamId);
    expect(assignments).toEqual([
      "team-1", "team-2", "team-3", "team-1", "team-2", "team-3", "team-1", "team-2",
    ]);
    expect(new Set(assignments).size).toBe(3);
    const beforeReconnect = state.players["team-player-2"].teamId;
    const student = publicRoomState(state, "team-player-2");
    expect(student.team?.teamId).toBe(beforeReconnect);
    expect(student.teamLeaderboard?.find((team) => team.teamId === beforeReconnect)?.memberCount).toBe(3);
    expect(student.self).toMatchObject({ teamId: beforeReconnect, teamNumber: 2 });
  });

  it("aggregates team scores while preserving individual action scores and privacy", () => {
    let state = createRoomState({
      code: "123456",
      teacherEmail: "teacher@example.com",
      questions: QUESTIONS,
      createdAt: 1_000,
      durationSeconds: 300,
      playStyle: "team",
      teamCount: 2,
    });
    state = addPlayer(state, "team-a", "가팀", 2_000);
    state = addPlayer(state, "team-b", "나팀", 2_100);
    state = addPlayer(state, "team-c", "다팀", 2_200);
    state = addPlayer(state, "team-d", "라팀", 2_300);
    state = {
      ...state,
      players: {
        ...state.players,
        "team-a": { ...state.players["team-a"], score: 100, correct: 1, answered: 1 },
        "team-b": { ...state.players["team-b"], score: 300, correct: 3, answered: 3 },
        "team-c": { ...state.players["team-c"], score: 200, correct: 2, answered: 2 },
        "team-d": { ...state.players["team-d"], score: 50, correct: 1, answered: 2 },
      },
    };
    const teacher = teacherRoomState(state);
    expect(teacher.teamLeaderboard?.map((team) => team.score)).toEqual([350, 300]);
    expect(teacher.teamLeaderboard?.map((team) => team.memberCount)).toEqual([2, 2]);
    expect(teacher.leaderboard[0]).toMatchObject({ teamId: "team-2", teamNumber: 2 });
    expect(teacher.leaderboard[0].score).toBe(300);
    const student = publicRoomState(state, "team-a");
    expect(JSON.stringify(student.teamLeaderboard)).not.toContain("accuracy");
    expect(JSON.stringify(student.teamLeaderboard)).not.toContain("correctCount");
    expect(JSON.stringify(student.teamLeaderboard)).not.toContain("playerId");
  });

  it("issues three opaque, stable treasure choices after a correct answer", () => {
    const started = startRoom(addPlayer(heistRoom()), 3_000);
    const submitted = submitCurrent(started, "player-1", 3_500);
    expect(submitted.result.treasureChoices).toHaveLength(3);
    expect(submitted.result.treasureChoices?.every((choice) => Object.keys(choice).sort().join() === "hint,id,label,strategy")).toBe(true);
    expect(submitted.result.treasureChoices?.map((choice) => choice.strategy)).toEqual(["safe", "team", "risk"]);
    expect(submitted.state.players["player-1"].pendingTreasureChoices).toHaveLength(3);
    expect(publicRoomState(submitted.state, "player-1").self?.treasureChoices).toEqual(
      submitted.result.treasureChoices,
    );
    expect(JSON.stringify(publicRoomState(submitted.state, "player-1"))).not.toContain("targetPlayerId");
    expect(JSON.stringify(publicRoomState(submitted.state, "player-1"))).not.toContain('"amount"');
  });

  it("prevents advancing until a treasure choice is selected", () => {
    const started = startRoom(addPlayer(heistRoom()), 3_000);
    const submitted = submitCurrent(started, "player-1", 3_500);
    const question = currentQuestion(submitted.state, "player-1");
    expectEngineCode(() => submitAnswer(submitted.state, {
      playerId: "player-1",
      questionId: question.id,
      occurrenceIndex: 1,
      answer: question.ans,
      serverNow: 4_000,
    }), "TREASURE_CHOICE_REQUIRED");
  });

  it("uses the server-issued safe bonus and rejects replay with a conflict code", () => {
    const started = startRoom(addPlayer(heistRoom()), 3_000);
    const submitted = submitCurrent(started, "player-1", 3_500);
    const safe = submitted.state.players["player-1"].pendingTreasureChoices?.find((choice) => choice.kind === "safe_bonus");
    expect(safe).toBeDefined();
    const chosen = chooseTreasure(submitted.state, {
      playerId: "player-1",
      choiceId: safe!.id,
      serverNow: 3_600,
    });
    expect(chosen.result).toMatchObject({ kind: "safe_bonus", amount: TREASURE_SAFE_BONUS });
    expect(chosen.state.players["player-1"].score).toBe(100 + TREASURE_SAFE_BONUS);
    expectEngineCode(() => chooseTreasure(chosen.state, {
      playerId: "player-1",
      choiceId: safe!.id,
      serverNow: 3_700,
    }), "DUPLICATE_TREASURE_CHOICE");
  });

  it("rejects a forged choice id instead of accepting client-supplied effects", () => {
    const started = startRoom(addPlayer(heistRoom()), 3_000);
    const submitted = submitCurrent(started, "player-1", 3_500);
    expectEngineCode(() => chooseTreasure(submitted.state, {
      playerId: "player-1",
      choiceId: "forged-choice",
      serverNow: 3_600,
    }), "TREASURE_NOT_AVAILABLE");
  });

  it("loots only the preselected victim and clamps the victim at zero", () => {
    let state = heistRoom();
    state = addPlayer(state, "player-1", "약탈자", 2_000);
    state = addPlayer(state, "player-2", "피해자", 2_100);
    state = startRoom(state, 3_000);
    state = {
      ...state,
      players: {
        ...state.players,
        "player-1": {
          ...state.players["player-1"],
          score: 100,
          pendingTreasureChoices: [{ id: "loot", kind: "loot", amount: TREASURE_LOOT_AMOUNT, targetPlayerId: "player-2" }],
        },
        "player-2": { ...state.players["player-2"], score: 40 },
      },
    };
    const chosen = chooseTreasure(state, { playerId: "player-1", choiceId: "loot", serverNow: 3_600 });
    expect(chosen.state.players["player-2"].score).toBe(0);
    expect(chosen.state.players["player-1"].score).toBe(140);
    expect(chosen.result).toMatchObject({ kind: "loot", amount: 40, targetNickname: "피해자" });
  });

  it("shares a small fixed amount with every player", () => {
    let state = startRoom(addPlayer(addPlayer(heistRoom(), "player-1", "하나", 2_000), "player-2", "둘", 2_100), 3_000);
    state = {
      ...state,
      players: {
        ...state.players,
        "player-1": { ...state.players["player-1"], score: 100, pendingTreasureChoices: [{ id: "share", kind: "share", amount: 25 }] },
        "player-2": { ...state.players["player-2"], score: 200 },
      },
    };
    const chosen = chooseTreasure(state, { playerId: "player-1", choiceId: "share", serverNow: 3_600 });
    expect(chosen.state.players["player-1"].score).toBe(125);
    expect(chosen.state.players["player-2"].score).toBe(225);
  });

  it("shares a team chest only with teammates in team play", () => {
    let state = startRoom(addPlayer(addPlayer(addPlayer(createRoomState({
      code: "123456",
      teacherEmail: "teacher@example.com",
      questions: QUESTIONS,
      createdAt: 1_000,
      durationSeconds: 300,
      mode: "treasure_heist",
      playStyle: "team",
      teamCount: 2,
    }), "player-1", "하나", 2_000), "player-2", "둘", 2_100), "player-3", "셋", 2_200), 3_000);
    state = {
      ...state,
      players: {
        ...state.players,
        "player-1": { ...state.players["player-1"], teamId: "team-1", score: 100, pendingTreasureChoices: [{ id: "share", kind: "share", amount: 25 }] },
        "player-2": { ...state.players["player-2"], teamId: "team-2", score: 200 },
        "player-3": { ...state.players["player-3"], teamId: "team-1", score: 300 },
      },
    };
    const chosen = chooseTreasure(state, { playerId: "player-1", choiceId: "share", serverNow: 3_600 });
    expect(chosen.state.players["player-1"].score).toBe(125);
    expect(chosen.state.players["player-2"].score).toBe(200);
    expect(chosen.state.players["player-3"].score).toBe(325);
  });

  it("clamps a trap deduction at zero", () => {
    let state = startRoom(addPlayer(heistRoom()), 3_000);
    state = {
      ...state,
      players: {
        ...state.players,
        "player-1": { ...state.players["player-1"], score: 20, pendingTreasureChoices: [{ id: "trap", kind: "trap", amount: 75 }] },
      },
    };
    const chosen = chooseTreasure(state, { playerId: "player-1", choiceId: "trap", serverNow: 3_600 });
    expect(chosen.state.players["player-1"].score).toBe(0);
    expect(chosen.result).toMatchObject({ kind: "trap", amount: 75, score: 0 });
  });

  it("does not issue treasure choices for an incorrect answer", () => {
    const started = startRoom(addPlayer(heistRoom()), 3_000);
    const wrong = submitCurrent(started, "player-1", 3_500, false);
    expect(wrong.result.correct).toBe(false);
    expect(wrong.result.treasureChoices).toBeUndefined();
    expect(wrong.state.players["player-1"].pendingTreasureChoices).toBeUndefined();
  });

  it("preserves optional question image fields in the student-safe question", () => {
    const imageQuestion = {
      ...QUESTIONS[0],
      image: "data:image/png;base64,encoded-image",
      imageUrl: "https://example.com/question.png",
    };
    const imageRoom = createRoomState({
      code: "123456",
      teacherEmail: "teacher@example.com",
      questions: [imageQuestion],
      createdAt: 1_000,
      durationSeconds: 300,
    });
    const started = startRoom(addPlayer(imageRoom), 3_000);
    expect(publicRoomState(started, "player-1").self?.currentQuestion).toMatchObject({
      image: imageQuestion.image,
      imageUrl: imageQuestion.imageUrl,
    });
  });

  it("creates a fixed private maze and only exposes a player's safe maze view", () => {
    let waiting = mazeRoom();
    waiting = addPlayer(waiting, "player-1", "하나", 2_000);
    waiting = addPlayer(waiting, "player-2", "둘", 2_100);
    const started = startRoom(waiting, 3_000);
    expect(started.maze?.layout).toHaveLength(7);
    expect(started.maze?.layout.join("\n")).toContain("S");
    const view = publicRoomState(started, "player-1");
    expect(view.self?.maze).toMatchObject({ x: 0, y: 0, moveCredits: 0, starDust: 0 });
    expect(view.self?.maze?.visibleTiles.length).toBeGreaterThan(0);
    expect(view.self?.maze?.nearbyPlayers).toEqual([
      { nickname: "둘", x: 0, y: 0, distance: 0 },
    ]);
    expect(view.self?.maze?.nearbyPlayers[0]).not.toHaveProperty("playerId");
    expect(view.self?.maze).not.toHaveProperty("layout");
    expect(JSON.stringify(view)).not.toContain('"treasure"');
  });

  it("grants two moves for a fast correct answer and three for a streak of three", () => {
    let state = startRoom(addPlayer(mazeRoom()), 3_000);
    state = submitCurrent(state, "player-1", 3_000 + MAZE_MOVE_FAST_THRESHOLD_MS).state;
    expect(state.players["player-1"].maze?.moveCredits).toBe(2);
    state = submitCurrent(state, "player-1", 6_000).state;
    state = submitCurrent(state, "player-1", 6_500).state;
    expect(state.players["player-1"].streak).toBe(3);
    expect(state.players["player-1"].maze?.moveCredits).toBe(7);
  });

  it("grants one move for a slow correct answer and none for a wrong answer", () => {
    let state = startRoom(addPlayer(mazeRoom()), 3_000);
    state = submitCurrent(state, "player-1", 6_500).state;
    expect(state.players["player-1"].maze?.moveCredits).toBe(1);
    state = submitCurrent(state, "player-1", 7_000, false).state;
    expect(state.players["player-1"].maze?.moveCredits).toBe(1);
  });

  it("accepts a sequential move and consumes exactly one movement right", () => {
    let state = startRoom(addPlayer(mazeRoom()), 3_000);
    state = { ...state, players: { ...state.players, "player-1": { ...state.players["player-1"], maze: { ...state.players["player-1"].maze!, moveCredits: 2 } } } };
    const moved = mazeMove(state, { playerId: "player-1", seq: 0, direction: "right", serverNow: 3_100 });
    expect(moved.result).toMatchObject({ seq: 0, x: 1, y: 0, moveCredits: 1 });
    expect(moved.state.players["player-1"].maze?.nextMoveSeq).toBe(1);
  });

  it("rejects duplicate and out-of-order maze sequences", () => {
    let state = startRoom(addPlayer(mazeRoom()), 3_000);
    state = { ...state, players: { ...state.players, "player-1": { ...state.players["player-1"], maze: { ...state.players["player-1"].maze!, moveCredits: 2 } } } };
    const moved = mazeMove(state, { playerId: "player-1", seq: 0, direction: "right", serverNow: 3_100 });
    expectEngineCode(() => mazeMove(moved.state, { playerId: "player-1", seq: 0, direction: "right", serverNow: 3_200 }), "DUPLICATE_MAZE_MOVE");
    expectEngineCode(() => mazeMove(moved.state, { playerId: "player-1", seq: 2, direction: "right", serverNow: 3_200 }), "MAZE_MOVE_OUT_OF_ORDER");
  });

  it("rejects walls, map boundaries, invalid directions, and empty movement rights", () => {
    let state = startRoom(addPlayer(mazeRoom()), 3_000);
    state = { ...state, players: { ...state.players, "player-1": { ...state.players["player-1"], maze: { ...state.players["player-1"].maze!, moveCredits: 1 } } } };
    expectEngineCode(() => mazeMove(state, { playerId: "player-1", seq: 0, direction: "up", serverNow: 3_100 }), "MAZE_MOVE_BLOCKED");
    expectEngineCode(() => mazeMove(state, { playerId: "player-1", seq: 0, direction: "left", serverNow: 3_100 }), "MAZE_MOVE_BLOCKED");
    expectEngineCode(() => mazeMove(state, { playerId: "player-1", seq: 0, direction: "diagonal" as "up", serverNow: 3_100 }), "INVALID_MAZE_MOVE");
    const noMoves = { ...state, players: { ...state.players, "player-1": { ...state.players["player-1"], maze: { ...state.players["player-1"].maze!, moveCredits: 0 } } } };
    expectEngineCode(() => mazeMove(noMoves, { playerId: "player-1", seq: 0, direction: "right", serverNow: 3_100 }), "MAZE_NO_MOVES");
  });

  it("applies key collection and keeps the hidden treasure location out of public state", () => {
    let state = startRoom(addPlayer(mazeRoom()), 3_000);
    state = { ...state, players: { ...state.players, "player-1": { ...state.players["player-1"], maze: { ...state.players["player-1"].maze!, x: 1, y: 2, moveCredits: 1 } } } };
    const moved = mazeMove(state, { playerId: "player-1", seq: 0, direction: "right", serverNow: 9_000 });
    expect(moved.result.event).toBe("key");
    expect(moved.state.players["player-1"].maze?.keys).toBe(1);
    expect(JSON.stringify(publicRoomState(moved.state, "player-1"))).not.toContain("collectedTreasures");
    expect(JSON.stringify(publicRoomState(moved.state, "player-1"))).not.toContain("layout");
  });

  it("teleports a player to the server-defined paired teleport tile", () => {
    let state = startRoom(addPlayer(mazeRoom()), 3_000);
    state = { ...state, players: { ...state.players, "player-1": { ...state.players["player-1"], maze: { ...state.players["player-1"].maze!, x: 4, y: 2, moveCredits: 1 } } } };
    const moved = mazeMove(state, { playerId: "player-1", seq: 0, direction: "right", serverNow: 9_000 });
    expect(moved.result.event).toBe("teleport");
    expect(moved.result).toMatchObject({ x: 4, y: 3 });
  });

  it("applies trap deductions without letting score fall below zero", () => {
    let state = startRoom(addPlayer(mazeRoom()), 3_000);
    state = { ...state, players: { ...state.players, "player-1": { ...state.players["player-1"], score: 20, maze: { ...state.players["player-1"].maze!, x: 4, y: 4, moveCredits: 1 } } } };
    const moved = mazeMove(state, { playerId: "player-1", seq: 0, direction: "right", serverNow: 9_000 });
    expect(moved.result.event).toBe("trap");
    expect(moved.state.players["player-1"].score).toBe(0);
  });

  it("collects a server-hidden treasure only after using a key", () => {
    let state = startRoom(addPlayer(mazeRoom()), 3_000);
    state = { ...state, players: { ...state.players, "player-1": { ...state.players["player-1"], maze: { ...state.players["player-1"].maze!, x: 1, y: 6, keys: 1, moveCredits: 1 } } } };
    const moved = mazeMove(state, { playerId: "player-1", seq: 0, direction: "right", serverNow: 9_000 });
    expect(moved.result.event).toBe("treasure");
    expect(moved.state.players["player-1"].starDust).toBe(20);
    expect(moved.state.players["player-1"].maze?.keys).toBe(0);
  });

  it("transfers at most 10 percent or 40 star dust on a fast encounter", () => {
    let state = mazeRoom();
    state = addPlayer(state, "player-1", "빠른이", 2_000);
    state = addPlayer(state, "player-2", "피해자", 2_100);
    state = startRoom(state, 3_000);
    state = {
      ...state,
      players: {
        ...state.players,
        "player-1": { ...state.players["player-1"], starDust: 0, maze: { ...state.players["player-1"].maze!, x: 1, y: 0, moveCredits: 1, lastFastAnswerAt: 9_000 } },
        "player-2": { ...state.players["player-2"], score: 1_000, starDust: 100, maze: { ...state.players["player-2"].maze!, x: 2, y: 0, spawnProtectedUntil: 0 } },
      },
    };
    const moved = mazeMove(state, { playerId: "player-1", seq: 0, direction: "right", serverNow: 9_100 });
    expect(moved.result.starDustTransferred).toBe(40);
    expect(moved.state.players["player-1"].starDust).toBe(40);
    expect(moved.state.players["player-2"].starDust).toBe(60);
  });

  it("never steals star dust from a teammate during a maze encounter", () => {
    let state = createRoomState({
      code: "123456",
      teacherEmail: "teacher@example.com",
      questions: QUESTIONS,
      createdAt: 1_000,
      durationSeconds: 300,
      shuffleQuestions: false,
      mode: "maze_heist",
      playStyle: "team",
      teamCount: 2,
    });
    state = addPlayer(state, "player-1", "빠른이", 2_000);
    state = addPlayer(state, "player-2", "같은팀", 2_100);
    state = addPlayer(state, "player-3", "상대팀", 2_200);
    state = startRoom(state, 3_000);
    state = {
      ...state,
      players: {
        ...state.players,
        "player-1": { ...state.players["player-1"], teamId: "team-1", starDust: 0, maze: { ...state.players["player-1"].maze!, x: 1, y: 0, moveCredits: 1, lastFastAnswerAt: 9_000 } },
        "player-2": { ...state.players["player-2"], teamId: "team-1", score: 1_000, starDust: 100, maze: { ...state.players["player-2"].maze!, x: 2, y: 0, spawnProtectedUntil: 0 } },
        "player-3": { ...state.players["player-3"], teamId: "team-2", score: 1_000, starDust: 100, maze: { ...state.players["player-3"].maze!, x: 3, y: 0, spawnProtectedUntil: 0 } },
      },
    };
    const moved = mazeMove(state, { playerId: "player-1", seq: 0, direction: "right", serverNow: 9_100 });
    expect(moved.result.targetNickname).toBe("상대팀");
    expect(moved.state.players["player-2"].starDust).toBe(100);
    expect(moved.state.players["player-3"].starDust).toBe(60);
  });

  it("blocks encounters with spawn protection and a shield, then honors the pair cooldown", () => {
    let state = mazeRoom();
    state = addPlayer(state, "player-1", "빠른이", 2_000);
    state = addPlayer(state, "player-2", "보호자", 2_100);
    state = startRoom(state, 3_000);
    state = {
      ...state,
      players: {
        ...state.players,
        "player-1": { ...state.players["player-1"], maze: { ...state.players["player-1"].maze!, x: 1, y: 0, moveCredits: 1, lastFastAnswerAt: 9_000 } },
        "player-2": { ...state.players["player-2"], starDust: 100, score: 500, maze: { ...state.players["player-2"].maze!, x: 2, y: 0, spawnProtectedUntil: 9_500, shieldUntil: 0 } },
      },
    };
    const protectedMove = mazeMove(state, { playerId: "player-1", seq: 0, direction: "right", serverNow: 9_100 });
    expect(protectedMove.result.blockedBySpawnProtection).toBe(true);
    const shielded = { ...protectedMove.state, players: { ...protectedMove.state.players, "player-1": { ...protectedMove.state.players["player-1"], maze: { ...protectedMove.state.players["player-1"].maze!, moveCredits: 1, nextMoveSeq: 1 } }, "player-2": { ...protectedMove.state.players["player-2"], maze: { ...protectedMove.state.players["player-2"].maze!, spawnProtectedUntil: 0, shieldUntil: 20_000 } } } };
    const shieldMove = mazeMove(shielded, { playerId: "player-1", seq: 1, direction: "left", serverNow: 9_200 });
    expect(shieldMove.result.blockedByShield).toBeUndefined();
    expect(shieldMove.state.players["player-2"].starDust).toBe(100);
    const cooldownState = { ...shieldMove.state, players: { ...shieldMove.state.players, "player-1": { ...shieldMove.state.players["player-1"], maze: { ...shieldMove.state.players["player-1"].maze!, moveCredits: 1, nextMoveSeq: 2, lastFastAnswerAt: 9_000 } }, "player-2": { ...shieldMove.state.players["player-2"], maze: { ...shieldMove.state.players["player-2"].maze!, shieldUntil: 0 } } } };
    const cooldownMove = mazeMove(cooldownState, { playerId: "player-1", seq: 2, direction: "right", serverNow: 9_300 });
    expect(cooldownMove.result.starDustTransferred).toBeUndefined();
    expect(cooldownMove.state.maze?.pairCooldowns["player-1:player-2"]).toBe(12_100);
    expect(MAZE_PAIR_COOLDOWN_MS).toBe(3_000);
  });

  it("uses score as the primary leaderboard value and star dust as its maze-only tie breaker", () => {
    let state = mazeRoom();
    state = addPlayer(state, "player-1", "별가루많음", 2_000);
    state = addPlayer(state, "player-2", "별가루적음", 2_100);
    state = {
      ...state,
      players: {
        ...state.players,
        "player-1": { ...state.players["player-1"], score: 500, starDust: 20 },
        "player-2": { ...state.players["player-2"], score: 500, starDust: 5 },
      },
    };
    expect(teacherRoomState(state).leaderboard.map((entry) => entry.playerId)).toEqual(["player-1", "player-2"]);
    expect(teacherRoomState(state).leaderboard[0].starDust).toBe(20);
    expect(publicRoomState(state, "player-1").leaderboard[0].starDust).toBe(20);
  });
});
