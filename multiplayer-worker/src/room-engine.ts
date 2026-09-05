export interface Question {
  id: string;
  kor: string;
  eng: string;
  ans: string;
  opts: string[];
  level: number | string;
  type?: string;
}

export interface AnswerRecord {
  occurrenceIndex: number;
  questionId: string;
  correct: boolean;
  responseTimeMs: number;
  scoreGain: number;
  submittedAt: number;
}

export interface PlayerState {
  id: string;
  nickname: string;
  resumeTokenHash: string;
  joinedAt: number;
  lastSeenAt: number;
  score: number;
  streak: number;
  correct: number;
  answered: number;
  responseTimeTotalMs: number;
  lastAnswer?: AnswerRecord;
  questionOrder: string[];
  optionOrders: Record<string, string[]>;
  questionIndex: number;
  questionStartedAt?: number;
}

export type RoomStatus = "lobby" | "playing" | "finished";

export interface RoomState {
  code: string;
  teacherEmail: string;
  status: RoomStatus;
  durationSeconds: number;
  allowLateJoin: boolean;
  shuffleQuestions: boolean;
  questions: Question[];
  players: Record<string, PlayerState>;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
}

export type EngineErrorCode =
  | "ROOM_STARTED"
  | "ROOM_NOT_PLAYING"
  | "DUPLICATE_ANSWER"
  | "UNKNOWN_PLAYER"
  | "UNKNOWN_QUESTION"
  | "NOT_CURRENT_QUESTION"
  | "INVALID_ANSWER"
  | "INVALID_START_TIME"
  | "INVALID_SUBMISSION_TIME"
  | "ROOM_EXPIRED"
  | "INVALID_NICKNAME"
  | "INVALID_ROOM";

export class EngineError extends Error {
  readonly code: EngineErrorCode;

  constructor(code: EngineErrorCode, message: string) {
    super(message);
    this.name = "EngineError";
    this.code = code;
  }
}

export interface CreateRoomInput {
  code: string;
  teacherEmail: string;
  durationSeconds: number;
  allowLateJoin?: boolean;
  shuffleQuestions?: boolean;
  questions: Question[];
  createdAt: number;
}

export interface JoinPlayerInput {
  id: string;
  nickname: string;
  resumeTokenHash: string;
  joinedAt: number;
}

export interface SubmitAnswerInput {
  playerId: string;
  questionId: string;
  occurrenceIndex: number;
  answer: string;
  serverNow: number;
}

export interface AnswerResult {
  questionId: string;
  occurrenceIndex: number;
  correct: boolean;
  scoreGain: number;
  score: number;
  streak: number;
  correctCount: number;
  answeredCount: number;
}

export interface PublicLeaderboardEntry {
  rank: number;
  nickname: string;
  score: number;
  isSelf: boolean;
}

export interface TeacherLeaderboardEntry {
  rank: number;
  playerId: string;
  nickname: string;
  score: number;
  accuracy: number;
  correctCount: number;
  answeredCount: number;
  averageResponseTimeMs: number | null;
}

export interface SafeQuestion {
  id: string;
  occurrenceIndex: number;
  kor: string;
  eng: string;
  opts: string[];
  level: number | string;
  type?: string;
}

export interface PublicRoomView {
  code: string;
  status: RoomStatus;
  durationSeconds: number;
  allowLateJoin: boolean;
  shuffleQuestions: boolean;
  startedAt?: number;
  finishedAt?: number;
  participantCount: number;
  questionCount: number;
  leaderboard: PublicLeaderboardEntry[];
  self?: TeacherLeaderboardEntry & {
    streak: number;
    currentQuestion?: SafeQuestion;
    answeredQuestionIds: string[];
  };
}

export interface TeacherRoomView {
  code: string;
  status: RoomStatus;
  durationSeconds: number;
  allowLateJoin: boolean;
  shuffleQuestions: boolean;
  startedAt?: number;
  finishedAt?: number;
  participantCount: number;
  questionCount: number;
  leaderboard: TeacherLeaderboardEntry[];
}

export function createRoomState(input: CreateRoomInput): RoomState {
  const code = input.code.trim();
  const teacherEmail = input.teacherEmail.trim().toLowerCase();
  if (
    !/^\d{6}$/.test(code) ||
    !teacherEmail ||
    ![60, 180, 300, 420, 600].includes(input.durationSeconds) ||
    (input.allowLateJoin !== undefined && typeof input.allowLateJoin !== "boolean") ||
    (input.shuffleQuestions !== undefined && typeof input.shuffleQuestions !== "boolean") ||
    !Number.isFinite(input.createdAt) ||
    input.createdAt < 0
  ) {
    throw new EngineError("INVALID_ROOM", "Room metadata is invalid.");
  }

  const seenIds = new Set<string>();
  const questions = input.questions.map((question) => {
    if (
      !question.id ||
      seenIds.has(question.id) ||
      question.opts.length < 2 ||
      !question.opts.includes(question.ans)
    ) {
      throw new EngineError("INVALID_ROOM", `Invalid question: ${question.id}`);
    }
    seenIds.add(question.id);
    return { ...question, opts: [...question.opts] };
  });

  if (questions.length === 0) {
    throw new EngineError("INVALID_ROOM", "A room needs at least one question.");
  }

  return {
    code,
    teacherEmail,
    status: "lobby",
    durationSeconds: input.durationSeconds,
    allowLateJoin: input.allowLateJoin ?? true,
    shuffleQuestions: input.shuffleQuestions ?? true,
    questions,
    players: {},
    createdAt: input.createdAt,
  };
}

export function joinPlayer(
  state: RoomState,
  input: JoinPlayerInput,
): { state: RoomState; player: PlayerState } {
  const lateJoinAllowed = state.status === "playing" &&
    state.allowLateJoin &&
    state.startedAt !== undefined &&
    Number.isFinite(input.joinedAt) &&
    input.joinedAt < state.startedAt + state.durationSeconds * 1_000;
  if (state.status !== "lobby" && !lateJoinAllowed) {
    throw new EngineError("ROOM_STARTED", "This room has already started.");
  }

  const nickname = normalizeNickname(input.nickname);
  if (!input.id || !input.resumeTokenHash || state.players[input.id]) {
    throw new EngineError("INVALID_NICKNAME", "Player identity is invalid.");
  }

  const questionIds = state.questions.map((question) => question.id);
  const questionOrder = state.shuffleQuestions
    ? shuffled(questionIds, `${state.code}:${input.id}:questions`)
    : questionIds;
  const optionOrders = Object.fromEntries(
    state.questions.map((question) => [
      question.id,
      shuffled(question.opts, `${state.code}:${input.id}:${question.id}:options`),
    ]),
  );
  const player: PlayerState = {
    id: input.id,
    nickname,
    resumeTokenHash: input.resumeTokenHash,
    joinedAt: input.joinedAt,
    lastSeenAt: input.joinedAt,
    score: 0,
    streak: 0,
    correct: 0,
    answered: 0,
    responseTimeTotalMs: 0,
    questionOrder,
    optionOrders,
    questionIndex: 0,
    questionStartedAt: state.status === "playing" ? input.joinedAt : undefined,
  };

  return {
    state: {
      ...state,
      players: { ...state.players, [player.id]: player },
    },
    player: clonePlayer(player),
  };
}

export function startRoom(state: RoomState, startedAt: number): RoomState {
  if (state.status !== "lobby") {
    throw new EngineError("ROOM_STARTED", "This room has already started.");
  }
  if (!Number.isFinite(startedAt) || startedAt < state.createdAt) {
    throw new EngineError("INVALID_START_TIME", "The room start time is invalid.");
  }
  const players = Object.fromEntries(
    Object.entries(state.players).map(([playerId, player]) => [
      playerId,
      { ...player, questionIndex: 0, questionStartedAt: startedAt },
    ]),
  );
  return { ...state, status: "playing", startedAt, players };
}

export function submitAnswer(
  state: RoomState,
  input: SubmitAnswerInput,
): { state: RoomState; result: AnswerResult } {
  if (state.status !== "playing") {
    throw new EngineError("ROOM_NOT_PLAYING", "The room is not accepting answers.");
  }

  const player = state.players[input.playerId];
  if (!player) {
    throw new EngineError("UNKNOWN_PLAYER", "The player is not in this room.");
  }

  if (!Number.isInteger(input.occurrenceIndex) || input.occurrenceIndex < 0) {
    throw new EngineError("NOT_CURRENT_QUESTION", "The question occurrence is invalid.");
  }
  if (input.occurrenceIndex < player.questionIndex) {
    throw new EngineError(
      "DUPLICATE_ANSWER",
      "This player already answered this question occurrence.",
    );
  }
  if (input.occurrenceIndex > player.questionIndex) {
    throw new EngineError(
      "NOT_CURRENT_QUESTION",
      "The submitted question is not the player's current question.",
    );
  }
  const currentQuestionId = questionIdForOccurrence(state, player, player.questionIndex);
  if (input.questionId !== currentQuestionId) {
    throw new EngineError(
      "NOT_CURRENT_QUESTION",
      "The submitted question is not the player's current question.",
    );
  }
  const question = state.questions.find((candidate) => candidate.id === input.questionId);
  if (!question) {
    throw new EngineError("UNKNOWN_QUESTION", "The question is not in this room.");
  }
  if (typeof input.answer !== "string" || !question.opts.includes(input.answer)) {
    throw new EngineError("INVALID_ANSWER", "The answer is not a valid option.");
  }

  const durationMs = state.durationSeconds * 1_000;
  if (
    !Number.isFinite(input.serverNow) ||
    state.startedAt === undefined ||
    player.questionStartedAt === undefined ||
    input.serverNow < player.questionStartedAt
  ) {
    throw new EngineError("INVALID_SUBMISSION_TIME", "The submission time is invalid.");
  }
  if (input.serverNow >= state.startedAt + durationMs) {
    throw new EngineError("ROOM_EXPIRED", "The room time has expired.");
  }
  const correct = input.answer === question.ans;
  const streak = correct ? player.streak + 1 : 0;
  const scoreGain = correct ? 100 + Math.min(streak - 1, 5) * 10 : 0;
  const responseTimeMs = Math.round(input.serverNow - player.questionStartedAt);
  const answerRecord: AnswerRecord = {
    occurrenceIndex: input.occurrenceIndex,
    questionId: input.questionId,
    correct,
    responseTimeMs,
    scoreGain,
    submittedAt: input.serverNow,
  };
  const nextPlayer: PlayerState = {
    ...player,
    score: player.score + scoreGain,
    streak,
    correct: player.correct + (correct ? 1 : 0),
    answered: player.answered + 1,
    responseTimeTotalMs: player.responseTimeTotalMs + responseTimeMs,
    lastSeenAt: input.serverNow,
    lastAnswer: answerRecord,
    questionIndex: player.questionIndex + 1,
    questionStartedAt: input.serverNow,
  };
  const nextState: RoomState = {
    ...state,
    players: { ...state.players, [player.id]: nextPlayer },
  };

  return {
    state: nextState,
    result: {
      questionId: input.questionId,
      occurrenceIndex: input.occurrenceIndex,
      correct,
      scoreGain,
      score: nextPlayer.score,
      streak,
      correctCount: nextPlayer.correct,
      answeredCount: nextPlayer.answered,
    },
  };
}

export function publicRoomState(
  state: RoomState,
  viewerPlayerId?: string,
): PublicRoomView {
  const ranked = rankedPlayers(state);
  const viewerRankIndex = viewerPlayerId
    ? ranked.findIndex(({ player }) => player.id === viewerPlayerId)
    : -1;
  if (viewerPlayerId && viewerRankIndex === -1) {
    throw new EngineError("UNKNOWN_PLAYER", "The player is not in this room.");
  }
  const visibleRanked = viewerPlayerId
    ? ranked.slice(Math.max(0, viewerRankIndex - 1), viewerRankIndex + 2)
    : state.status === "lobby"
      ? ranked
      : [];
  const leaderboard = visibleRanked.map(({ rank, player }) => ({
    rank,
    nickname: player.nickname,
    score: player.score,
    isSelf: player.id === viewerPlayerId,
  }));
  const viewer = viewerPlayerId ? state.players[viewerPlayerId] : undefined;

  return {
    code: state.code,
    status: state.status,
    durationSeconds: state.durationSeconds,
    allowLateJoin: state.allowLateJoin,
    shuffleQuestions: state.shuffleQuestions,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    participantCount: ranked.length,
    questionCount: state.questions.length,
    leaderboard,
    self: viewer
      ? {
          ...toTeacherEntry(viewer, viewerRankIndex + 1),
          streak: viewer.streak,
          currentQuestion: currentSafeQuestion(state, viewer),
          answeredQuestionIds: answeredQuestionIdsInCurrentCycle(state, viewer),
        }
      : undefined,
  };
}

export function teacherRoomState(state: RoomState): TeacherRoomView {
  const ranked = rankedPlayers(state);
  return {
    code: state.code,
    status: state.status,
    durationSeconds: state.durationSeconds,
    allowLateJoin: state.allowLateJoin,
    shuffleQuestions: state.shuffleQuestions,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    participantCount: ranked.length,
    questionCount: state.questions.length,
    leaderboard: ranked.map(({ rank, player }) => toTeacherEntry(player, rank)),
  };
}

export function normalizeNickname(value: string): string {
  const normalized = value.trim().replace(/\s+/gu, " ");
  const shortened = Array.from(normalized).slice(0, 18).join("");
  if (!shortened) {
    throw new EngineError("INVALID_NICKNAME", "Enter a nickname.");
  }
  return shortened;
}

function toTeacherEntry(player: PlayerState, rank: number): TeacherLeaderboardEntry {
  return {
    rank,
    playerId: player.id,
    nickname: player.nickname,
    score: player.score,
    accuracy: player.answered === 0 ? 0 : player.correct / player.answered,
    correctCount: player.correct,
    answeredCount: player.answered,
    averageResponseTimeMs:
      player.answered === 0 ? null : Math.round(player.responseTimeTotalMs / player.answered),
  };
}

function currentSafeQuestion(state: RoomState, player: PlayerState): SafeQuestion | undefined {
  if (state.status !== "playing") return undefined;
  const questionId = questionIdForOccurrence(state, player, player.questionIndex);
  const question = state.questions.find((candidate) => candidate.id === questionId);
  if (!question) {
    throw new EngineError("UNKNOWN_QUESTION", "Player question order is invalid.");
  }
  return {
    id: question.id,
    occurrenceIndex: player.questionIndex,
    kor: question.kor,
    eng: question.eng,
    opts: [...player.optionOrders[question.id]],
    level: question.level,
    type: question.type,
  };
}

function questionIdForOccurrence(
  state: RoomState,
  player: PlayerState,
  occurrenceIndex: number,
): string {
  const questionCount = state.questions.length;
  const cycleIndex = Math.floor(occurrenceIndex / questionCount);
  const positionInCycle = occurrenceIndex % questionCount;
  const order = !state.shuffleQuestions || cycleIndex === 0
    ? player.questionOrder
    : shuffled(
        state.questions.map((question) => question.id),
        `${state.code}:${player.id}:questions:cycle:${cycleIndex}`,
      );
  const questionId = order[positionInCycle];
  if (!questionId) throw new EngineError("UNKNOWN_QUESTION", "Question cycle is invalid.");
  return questionId;
}

function answeredQuestionIdsInCurrentCycle(state: RoomState, player: PlayerState): string[] {
  const questionCount = state.questions.length;
  const cycleStart = Math.floor(player.questionIndex / questionCount) * questionCount;
  const answeredIds: string[] = [];
  for (let index = cycleStart; index < player.questionIndex; index += 1) {
    answeredIds.push(questionIdForOccurrence(state, player, index));
  }
  return answeredIds;
}

function rankedPlayers(state: RoomState): Array<{ rank: number; player: PlayerState }> {
  return Object.values(state.players)
    .sort((left, right) => {
      const scoreDifference = right.score - left.score;
      if (scoreDifference !== 0) return scoreDifference;

      const leftAccuracy = left.answered === 0 ? 0 : left.correct / left.answered;
      const rightAccuracy = right.answered === 0 ? 0 : right.correct / right.answered;
      const accuracyDifference = rightAccuracy - leftAccuracy;
      if (accuracyDifference !== 0) return accuracyDifference;

      const correctDifference = right.correct - left.correct;
      if (correctDifference !== 0) return correctDifference;

      const leftAverage =
        left.answered === 0 ? Number.POSITIVE_INFINITY : left.responseTimeTotalMs / left.answered;
      const rightAverage =
        right.answered === 0
          ? Number.POSITIVE_INFINITY
          : right.responseTimeTotalMs / right.answered;
      const responseDifference = leftAverage - rightAverage;
      if (responseDifference !== 0) return responseDifference;

      const joinDifference = left.joinedAt - right.joinedAt;
      if (joinDifference !== 0) return joinDifference;
      return left.id.localeCompare(right.id);
    })
    .map((player, index) => ({ rank: index + 1, player }));
}

function shuffled<T>(values: T[], seed: string): T[] {
  const output = [...values];
  const random = mulberry32(hashString(seed));
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}

function clonePlayer(player: PlayerState): PlayerState {
  return {
    ...player,
    lastAnswer: player.lastAnswer ? { ...player.lastAnswer } : undefined,
    questionOrder: [...player.questionOrder],
    optionOrders: Object.fromEntries(
      Object.entries(player.optionOrders).map(([questionId, options]) => [
        questionId,
        [...options],
      ]),
    ),
  };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
