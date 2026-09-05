export interface Question {
  id: string;
  kor: string;
  eng: string;
  ans: string;
  opts: string[];
  level: number | string;
  type?: string;
  image?: string;
  imageUrl?: string;
}

export interface AnswerRecord {
  occurrenceIndex: number;
  questionId: string;
  correct: boolean;
  responseTimeMs: number;
  scoreGain: number;
  submittedAt: number;
}

export type RoomMode = "score_race" | "treasure_heist" | "maze_heist";
export type PlayStyle = "individual" | "team";
export type TreasureOutcomeKind = "safe_bonus" | "loot" | "share" | "trap";
export type TreasureStrategy = "safe" | "team" | "risk";

export type MazeTileKind =
  | "floor"
  | "wall"
  | "key"
  | "treasure"
  | "trap"
  | "teleport"
  | "shield"
  | "spawn";
export type MazeDirection = "up" | "down" | "left" | "right";

export const MAZE_MOVE_FAST_THRESHOLD_MS = 3_000;
export const MAZE_FAST_AUTHORITY_WINDOW_MS = 5_000;
export const MAZE_SPAWN_PROTECTION_MS = 5_000;
export const MAZE_PAIR_COOLDOWN_MS = 3_000;
export const MAZE_TRAP_SCORE_PENALTY = 50;
export const MAZE_TREASURE_STAR_DUST = 20;

const MAZE_LAYOUT: readonly string[] = [
  "S..#...T.",
  ".#.#.##..",
  "..K..P...",
  "..##P.#..",
  "...H.X...",
  "...#.....",
  "..T......",
];

export const TREASURE_SAFE_BONUS = 150;
export const TREASURE_LOOT_AMOUNT = 100;
export const TREASURE_SHARE_AMOUNT = 25;
export const TREASURE_TRAP_AMOUNT = 75;

export interface TreasureChoice {
  id: string;
  strategy?: TreasureStrategy;
  kind: TreasureOutcomeKind;
  amount: number;
  targetPlayerId?: string;
}

export interface TreasureChoiceView {
  id: string;
  strategy: TreasureStrategy;
  label: string;
  hint: string;
}

export interface MazePlayerState {
  x: number;
  y: number;
  moveCredits: number;
  nextMoveSeq: number;
  keys: number;
  shieldUntil: number;
  spawnProtectedUntil: number;
  lastFastAnswerAt?: number;
}

export interface MazeState {
  layout: string[];
  pairCooldowns: Record<string, number>;
  collectedTreasures: Record<string, boolean>;
}

export interface MazePlayerView {
  x: number;
  y: number;
  moveCredits: number;
  keys: number;
  starDust: number;
  shieldActive: boolean;
  nextMoveSeq: number;
  visibleTiles: MazeVisibleTile[];
  nearbyPlayers: MazeNearbyPlayer[];
}

export interface MazeVisibleTile {
  x: number;
  y: number;
  kind: Exclude<MazeTileKind, "treasure">;
}

export interface MazeNearbyPlayer {
  nickname: string;
  x: number;
  y: number;
  distance: number;
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
  pendingTreasureChoices?: TreasureChoice[];
  consumedTreasureChoiceIds?: string[];
  starDust: number;
  teamId?: string;
  maze?: MazePlayerState;
}

export type RoomStatus = "lobby" | "playing" | "finished";

export interface RoomState {
  code: string;
  teacherEmail: string;
  status: RoomStatus;
  durationSeconds: number;
  allowLateJoin: boolean;
  shuffleQuestions: boolean;
  mode: RoomMode;
  playStyle: PlayStyle;
  teamCount?: number;
  maze?: MazeState;
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
  | "INVALID_ROOM"
  | "TREASURE_CHOICE_REQUIRED"
  | "TREASURE_NOT_AVAILABLE"
  | "DUPLICATE_TREASURE_CHOICE"
  | "MAZE_MOVE_OUT_OF_ORDER"
  | "DUPLICATE_MAZE_MOVE"
  | "MAZE_MOVE_BLOCKED"
  | "MAZE_NO_MOVES"
  | "INVALID_MAZE_MOVE";

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
  mode?: RoomMode;
  playStyle?: PlayStyle;
  teamCount?: number;
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

export interface ChooseTreasureInput {
  playerId: string;
  choiceId: string;
  serverNow: number;
}

export interface MazeMoveInput {
  playerId: string;
  seq: number;
  direction: MazeDirection;
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
  treasureChoices?: TreasureChoiceView[];
}

export interface TreasureResult {
  choiceId: string;
  kind: TreasureOutcomeKind;
  amount: number;
  score: number;
  targetNickname?: string;
}

export interface MazeMoveResult {
  seq: number;
  x: number;
  y: number;
  moveCredits: number;
  event?: "key" | "treasure" | "trap" | "teleport" | "shield" | "encounter";
  starDust: number;
  starDustTransferred?: number;
  targetNickname?: string;
  blockedByShield?: boolean;
  blockedBySpawnProtection?: boolean;
}

export interface PublicLeaderboardEntry {
  rank: number;
  nickname: string;
  score: number;
  isSelf: boolean;
  starDust?: number;
}

export interface TeamLeaderboardEntry {
  rank: number;
  teamId: string;
  teamNumber: number;
  score: number;
  memberCount: number;
  isSelf?: boolean;
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
  starDust?: number;
  teamId?: string;
  teamNumber?: number;
}

export interface SafeQuestion {
  id: string;
  occurrenceIndex: number;
  kor: string;
  eng: string;
  opts: string[];
  level: number | string;
  type?: string;
  image?: string;
  imageUrl?: string;
}

export interface PublicRoomView {
  code: string;
  status: RoomStatus;
  durationSeconds: number;
  allowLateJoin: boolean;
  shuffleQuestions: boolean;
  mode: RoomMode;
  playStyle: PlayStyle;
  teamCount?: number;
  startedAt?: number;
  finishedAt?: number;
  participantCount: number;
  questionCount: number;
  leaderboard: PublicLeaderboardEntry[];
  teamLeaderboard?: TeamLeaderboardEntry[];
  team?: TeamLeaderboardEntry;
  self?: TeacherLeaderboardEntry & {
    streak: number;
    currentQuestion?: SafeQuestion;
    answeredQuestionIds: string[];
    treasureChoices?: TreasureChoiceView[];
    maze?: MazePlayerView;
  };
}

export interface TeacherRoomView {
  code: string;
  status: RoomStatus;
  durationSeconds: number;
  allowLateJoin: boolean;
  shuffleQuestions: boolean;
  mode: RoomMode;
  playStyle: PlayStyle;
  teamCount?: number;
  startedAt?: number;
  finishedAt?: number;
  participantCount: number;
  questionCount: number;
  leaderboard: TeacherLeaderboardEntry[];
  teamLeaderboard?: TeamLeaderboardEntry[];
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
    (input.mode !== undefined && input.mode !== "score_race" && input.mode !== "treasure_heist" && input.mode !== "maze_heist") ||
    (input.playStyle !== undefined && input.playStyle !== "individual" && input.playStyle !== "team") ||
    (input.playStyle === "team" && (!Number.isInteger(input.teamCount) || input.teamCount! < 2 || input.teamCount! > 4)) ||
    (input.playStyle !== "team" && input.teamCount !== undefined) ||
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
    mode: input.mode ?? "score_race",
    playStyle: input.playStyle ?? "individual",
    teamCount: input.playStyle === "team" ? input.teamCount : undefined,
    maze: input.mode === "maze_heist" ? createMazeState() : undefined,
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
    starDust: 0,
    teamId: state.playStyle === "team" ? chooseTeamId(state) : undefined,
    maze: state.mode === "maze_heist"
      ? createMazePlayer(input.joinedAt + MAZE_SPAWN_PROTECTION_MS)
      : undefined,
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
      {
        ...player,
        questionIndex: 0,
        questionStartedAt: startedAt,
        maze: player.maze
          ? { ...player.maze, x: 0, y: 0, spawnProtectedUntil: startedAt + MAZE_SPAWN_PROTECTION_MS }
          : undefined,
      },
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
  if (state.mode === "treasure_heist" && player.pendingTreasureChoices?.length) {
    throw new EngineError(
      "TREASURE_CHOICE_REQUIRED",
      "Choose a treasure chest before answering the next question.",
    );
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
  const nextMaze = state.mode === "maze_heist"
    ? updateMazeAfterAnswer(player.maze ?? createMazePlayer(input.serverNow + MAZE_SPAWN_PROTECTION_MS), correct, responseTimeMs, streak, input.serverNow)
    : undefined;
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
    starDust: player.starDust ?? 0,
    maze: nextMaze,
    pendingTreasureChoices: state.mode === "treasure_heist" && correct
      ? createTreasureChoices(state, player.id, input.occurrenceIndex)
      : undefined,
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
      treasureChoices: nextPlayer.pendingTreasureChoices?.map(toTreasureChoiceView),
    },
  };
}

export function mazeMove(
  state: RoomState,
  input: MazeMoveInput,
): { state: RoomState; result: MazeMoveResult } {
  if (state.status !== "playing") {
    throw new EngineError("ROOM_NOT_PLAYING", "The room is not accepting moves.");
  }
  if (state.mode !== "maze_heist" || !state.maze) {
    throw new EngineError("INVALID_MAZE_MOVE", "Maze moves are not available in this room.");
  }
  if (!Number.isFinite(input.serverNow) || state.startedAt === undefined ||
    input.serverNow < state.startedAt ||
    input.serverNow >= state.startedAt + state.durationSeconds * 1_000) {
    throw new EngineError("ROOM_EXPIRED", "The room time has expired.");
  }
  const player = state.players[input.playerId];
  if (!player) throw new EngineError("UNKNOWN_PLAYER", "The player is not in this room.");
  const maze = player.maze;
  if (!maze) throw new EngineError("INVALID_MAZE_MOVE", "The player's maze state is invalid.");
  if (!Number.isInteger(input.seq) || input.seq < 0) {
    throw new EngineError("INVALID_MAZE_MOVE", "The move sequence is invalid.");
  }
  if (input.seq < maze.nextMoveSeq) {
    throw new EngineError("DUPLICATE_MAZE_MOVE", "This maze move was already applied.");
  }
  if (input.seq > maze.nextMoveSeq) {
    throw new EngineError("MAZE_MOVE_OUT_OF_ORDER", "The maze move sequence is out of order.");
  }
  if (!["up", "down", "left", "right"].includes(input.direction)) {
    throw new EngineError("INVALID_MAZE_MOVE", "The maze direction is invalid.");
  }
  if (maze.moveCredits <= 0) throw new EngineError("MAZE_NO_MOVES", "No maze moves remain.");
  const deltas: Record<MazeDirection, [number, number]> = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0],
  };
  const delta = deltas[input.direction];
  const nextX = maze.x + delta[0];
  const nextY = maze.y + delta[1];
  if (mazeTile(state.maze, nextX, nextY) === "wall" || mazeTile(state.maze, nextX, nextY) === undefined) {
    throw new EngineError("MAZE_MOVE_BLOCKED", "That maze move is blocked.");
  }

  const nextMaze: MazePlayerState = {
    ...maze,
    x: nextX,
    y: nextY,
    moveCredits: maze.moveCredits - 1,
    nextMoveSeq: maze.nextMoveSeq + 1,
  };
  const players: Record<string, PlayerState> = Object.fromEntries(
    Object.entries(state.players).map(([id, candidate]) => [id, {
      ...candidate,
      starDust: candidate.starDust ?? 0,
      maze: candidate.maze ? { ...candidate.maze } : undefined,
    }]),
  );
  const mover = { ...players[player.id], maze: nextMaze };
  let event: MazeMoveResult["event"];
  const tile = mazeTile(state.maze, nextX, nextY);
  const tileEffect = applyMazeTile(mover, tile, input.serverNow, state.maze, nextX, nextY);
  players[player.id] = tileEffect.player;
  event = tileEffect.event;

  const encounter = applyMazeEncounter(state, players, player.id, input.serverNow);
  players[player.id] = encounter.mover;
  if (encounter.targetId && encounter.target) players[encounter.targetId] = encounter.target;
  if (encounter.event) event = encounter.event;
  const nextState: RoomState = {
    ...state,
    maze: {
      ...state.maze,
      pairCooldowns: encounter.pairCooldowns,
      collectedTreasures: tileEffect.collectedTreasures,
    },
    players,
  };
  return {
    state: nextState,
    result: {
      seq: input.seq,
      x: encounter.mover.maze!.x,
      y: encounter.mover.maze!.y,
      moveCredits: encounter.mover.maze!.moveCredits,
      event,
      starDust: encounter.mover.starDust,
      starDustTransferred: encounter.transferred || undefined,
      targetNickname: encounter.targetNickname,
      blockedByShield: encounter.blockedByShield || undefined,
      blockedBySpawnProtection: encounter.blockedBySpawnProtection || undefined,
    },
  };
}

export function chooseTreasure(
  state: RoomState,
  input: ChooseTreasureInput,
): { state: RoomState; result: TreasureResult } {
  if (state.status !== "playing") {
    throw new EngineError("ROOM_NOT_PLAYING", "The room is not accepting answers.");
  }
  if (!Number.isFinite(input.serverNow) || state.startedAt === undefined ||
    input.serverNow < state.startedAt ||
    input.serverNow >= state.startedAt + state.durationSeconds * 1_000) {
    throw new EngineError("ROOM_EXPIRED", "The room time has expired.");
  }
  const player = state.players[input.playerId];
  if (!player) throw new EngineError("UNKNOWN_PLAYER", "The player is not in this room.");
  const pending = player.pendingTreasureChoices;
  if (!pending?.length) {
    if (player.consumedTreasureChoiceIds?.includes(input.choiceId)) {
      throw new EngineError("DUPLICATE_TREASURE_CHOICE", "This treasure choice was already used.");
    }
    throw new EngineError("TREASURE_NOT_AVAILABLE", "There is no treasure choice to use.");
  }
  const choice = pending.find((candidate) => candidate.id === input.choiceId);
  if (!choice) {
    throw new EngineError("TREASURE_NOT_AVAILABLE", "This treasure choice is not available.");
  }

  const players = Object.fromEntries(
    Object.entries(state.players).map(([id, candidate]) => [id, { ...candidate }]),
  );
  const chooser = { ...players[player.id] };
  let score = chooser.score;
  let targetNickname: string | undefined;
  if (choice.kind === "safe_bonus") {
    score += choice.amount;
  } else if (choice.kind === "loot") {
    const target = choice.targetPlayerId ? players[choice.targetPlayerId] : undefined;
    if (target) {
      const victim = { ...target, score: Math.max(0, target.score - choice.amount) };
      players[target.id] = victim;
      targetNickname = target.nickname;
      score += target.score - victim.score;
    }
  } else if (choice.kind === "share") {
    for (const [id, candidate] of Object.entries(players)) {
      if (state.playStyle !== "team" || candidate.teamId === chooser.teamId) {
        players[id] = { ...candidate, score: candidate.score + choice.amount };
      }
    }
    score = players[player.id].score;
  } else {
    score = Math.max(0, score - choice.amount);
  }
  players[player.id] = {
    ...chooser,
    score,
    lastSeenAt: input.serverNow,
    pendingTreasureChoices: undefined,
    consumedTreasureChoiceIds: [
      ...(player.consumedTreasureChoiceIds ?? []),
      ...pending.map((candidate) => candidate.id),
    ].slice(-6),
  };
  return {
    state: { ...state, players },
    result: {
      choiceId: choice.id,
      kind: choice.kind,
      amount: choice.kind === "loot" && choice.targetPlayerId && players[choice.targetPlayerId]
        ? Math.min(choice.amount, state.players[choice.targetPlayerId].score)
        : choice.amount,
      score,
      targetNickname,
    },
  };
}

export function publicRoomState(
  state: RoomState,
  viewerPlayerId?: string,
): PublicRoomView {
  const playStyle = state.playStyle ?? "individual";
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
    ...(state.mode === "maze_heist" ? { starDust: player.starDust ?? 0 } : {}),
  }));
  const viewer = viewerPlayerId ? state.players[viewerPlayerId] : undefined;

  return {
    code: state.code,
    status: state.status,
    durationSeconds: state.durationSeconds,
    allowLateJoin: state.allowLateJoin,
    shuffleQuestions: state.shuffleQuestions,
    mode: state.mode,
    playStyle,
    teamCount: state.teamCount,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    participantCount: ranked.length,
    questionCount: state.questions.length,
    leaderboard,
    teamLeaderboard: playStyle === "team" ? rankedTeams(state, viewerPlayerId) : undefined,
    team: playStyle === "team" && viewer?.teamId
      ? rankedTeams(state, viewerPlayerId).find((team) => team.teamId === viewer.teamId)
      : undefined,
    self: viewer
      ? {
          ...toTeacherEntry(viewer, viewerRankIndex + 1, state.mode === "maze_heist"),
          streak: viewer.streak,
          currentQuestion: currentSafeQuestion(state, viewer),
          answeredQuestionIds: answeredQuestionIdsInCurrentCycle(state, viewer),
          treasureChoices: viewer.pendingTreasureChoices?.map(toTreasureChoiceView),
          maze: state.mode === "maze_heist" ? mazePlayerView(state, viewer, Date.now()) : undefined,
        }
      : undefined,
  };
}

export function teacherRoomState(state: RoomState): TeacherRoomView {
  const playStyle = state.playStyle ?? "individual";
  const ranked = rankedPlayers(state);
  return {
    code: state.code,
    status: state.status,
    durationSeconds: state.durationSeconds,
    allowLateJoin: state.allowLateJoin,
    shuffleQuestions: state.shuffleQuestions,
    mode: state.mode,
    playStyle,
    teamCount: state.teamCount,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    participantCount: ranked.length,
    questionCount: state.questions.length,
    leaderboard: ranked.map(({ rank, player }) => toTeacherEntry(player, rank, state.mode === "maze_heist")),
    teamLeaderboard: playStyle === "team" ? rankedTeams(state) : undefined,
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

function toTeacherEntry(player: PlayerState, rank: number, includeStarDust = false): TeacherLeaderboardEntry {
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
    ...(includeStarDust ? { starDust: player.starDust ?? 0 } : {}),
    ...(player.teamId ? { teamId: player.teamId, teamNumber: teamNumber(player.teamId) } : {}),
  };
}

function mazePlayerView(state: RoomState, player: PlayerState, now: number): MazePlayerView | undefined {
  if (!player.maze) return undefined;
  const visibleTiles: MazeVisibleTile[] = [];
  for (let y = player.maze.y - 1; y <= player.maze.y + 1; y += 1) {
    for (let x = player.maze.x - 1; x <= player.maze.x + 1; x += 1) {
      const kind = mazeTile(state.maze!, x, y);
      if (!kind) continue;
      visibleTiles.push({ x, y, kind: kind === "treasure" ? "floor" : kind });
    }
  }
  const nearbyPlayers = Object.values(state.players)
    .filter((candidate) => candidate.id !== player.id && candidate.maze)
    .map((candidate) => ({
      candidate,
      distance: Math.abs(candidate.maze!.x - player.maze!.x) + Math.abs(candidate.maze!.y - player.maze!.y),
    }))
    .filter(({ distance }) => distance <= 2)
    .sort((left, right) => left.distance - right.distance || left.candidate.id.localeCompare(right.candidate.id))
    .map(({ candidate, distance }) => ({
      nickname: candidate.nickname,
      x: candidate.maze!.x,
      y: candidate.maze!.y,
      distance,
    }));
  return {
    x: player.maze.x,
    y: player.maze.y,
    moveCredits: player.maze.moveCredits,
    keys: player.maze.keys,
    starDust: player.starDust ?? 0,
    shieldActive: player.maze.shieldUntil > now,
    nextMoveSeq: player.maze.nextMoveSeq,
    visibleTiles,
    nearbyPlayers,
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
    ...(question.image !== undefined ? { image: question.image } : {}),
    ...(question.imageUrl !== undefined ? { imageUrl: question.imageUrl } : {}),
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
      if (state.playStyle === "team") {
        const teamScoreDifference = teamScore(state, right.teamId) - teamScore(state, left.teamId);
        if (teamScoreDifference !== 0) return teamScoreDifference;
      }
      const scoreDifference = right.score - left.score;
      if (scoreDifference !== 0) return scoreDifference;

      const starDustDifference = (right.starDust ?? 0) - (left.starDust ?? 0);
      if (state.mode === "maze_heist" && starDustDifference !== 0) return starDustDifference;

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

function chooseTeamId(state: RoomState): string {
  const teamCount = state.teamCount ?? 2;
  let selected = 1;
  let selectedSize = Number.POSITIVE_INFINITY;
  for (let number = 1; number <= teamCount; number += 1) {
    const size = Object.values(state.players).filter((player) => player.teamId === `team-${number}`).length;
    if (size < selectedSize) {
      selected = number;
      selectedSize = size;
    }
  }
  return `team-${selected}`;
}

function teamNumber(teamId: string): number {
  const number = Number(teamId.replace(/^team-/, ""));
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function teamScore(state: RoomState, teamId?: string): number {
  if (!teamId) return 0;
  return Object.values(state.players)
    .filter((player) => player.teamId === teamId)
    .reduce((total, player) => total + player.score, 0);
}

function rankedTeams(state: RoomState, viewerPlayerId?: string): TeamLeaderboardEntry[] {
  const teams = new Map<string, { score: number; memberCount: number }>();
  if (state.playStyle === "team") {
    for (let number = 1; number <= (state.teamCount ?? 2); number += 1) {
      teams.set(`team-${number}`, { score: 0, memberCount: 0 });
    }
  }
  for (const player of Object.values(state.players)) {
    if (!player.teamId) continue;
    const current = teams.get(player.teamId) ?? { score: 0, memberCount: 0 };
    current.score += player.score;
    current.memberCount += 1;
    teams.set(player.teamId, current);
  }
  return [...teams.entries()]
    .sort((left, right) => right[1].score - left[1].score || teamNumber(left[0]) - teamNumber(right[0]))
    .map(([teamId, summary], index) => ({
      rank: index + 1,
      teamId,
      teamNumber: teamNumber(teamId),
      score: summary.score,
      memberCount: summary.memberCount,
      ...(viewerPlayerId ? { isSelf: state.players[viewerPlayerId]?.teamId === teamId } : {}),
    }));
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
    pendingTreasureChoices: player.pendingTreasureChoices?.map((choice) => ({ ...choice })),
    consumedTreasureChoiceIds: player.consumedTreasureChoiceIds
      ? [...player.consumedTreasureChoiceIds]
      : undefined,
    starDust: player.starDust ?? 0,
    maze: player.maze ? { ...player.maze } : undefined,
    questionOrder: [...player.questionOrder],
    optionOrders: Object.fromEntries(
      Object.entries(player.optionOrders).map(([questionId, options]) => [
        questionId,
        [...options],
      ]),
    ),
  };
}

function toTreasureChoiceView(choice: TreasureChoice): TreasureChoiceView {
  const strategy = choice.strategy ?? (
    choice.kind === "safe_bonus" ? "safe" : choice.kind === "share" ? "team" : "risk"
  );
  return {
    id: choice.id,
    strategy,
    label: strategy === "safe" ? "안전 상자" : strategy === "team" ? "팀 상자" : "위험 상자",
    hint: strategy === "safe" ? "확정 보너스" : strategy === "team" ? "모두에게 나눔" : "큰 보상 또는 함정",
  };
}

function createMazeState(): MazeState {
  return { layout: [...MAZE_LAYOUT], pairCooldowns: {}, collectedTreasures: {} };
}

function createMazePlayer(spawnProtectedUntil: number): MazePlayerState {
  return {
    x: 0,
    y: 0,
    moveCredits: 0,
    nextMoveSeq: 0,
    keys: 0,
    shieldUntil: 0,
    spawnProtectedUntil,
  };
}

function updateMazeAfterAnswer(
  maze: MazePlayerState,
  correct: boolean,
  responseTimeMs: number,
  streak: number,
  now: number,
): MazePlayerState {
  if (!correct) return { ...maze };
  const credits = 1 + (responseTimeMs <= MAZE_MOVE_FAST_THRESHOLD_MS ? 1 : 0) + (streak >= 3 ? 1 : 0);
  return {
    ...maze,
    moveCredits: Math.min(9, maze.moveCredits + credits),
    lastFastAnswerAt: responseTimeMs <= MAZE_MOVE_FAST_THRESHOLD_MS
      ? now
      : undefined,
  };
}

function mazeTile(maze: MazeState, x: number, y: number): MazeTileKind | undefined {
  if (y < 0 || y >= maze.layout.length || x < 0 || x >= maze.layout[y].length) return undefined;
  const symbol = maze.layout[y][x];
  return {
    ".": "floor",
    "#": "wall",
    K: "key",
    T: "treasure",
    X: "trap",
    P: "teleport",
    H: "shield",
    S: "spawn",
  }[symbol] as MazeTileKind | undefined;
}

function mazePositionKey(x: number, y: number): string {
  return `${x},${y}`;
}

function teleportDestination(maze: MazeState, x: number, y: number): [number, number] | undefined {
  const teleports: Array<[number, number]> = [];
  for (let row = 0; row < maze.layout.length; row += 1) {
    for (let column = 0; column < maze.layout[row].length; column += 1) {
      if (mazeTile(maze, column, row) === "teleport") teleports.push([column, row]);
    }
  }
  const index = teleports.findIndex(([column, row]) => column === x && row === y);
  return index === -1 || teleports.length < 2 ? undefined : teleports[(index + 1) % teleports.length];
}

function applyMazeTile(
  player: PlayerState,
  tile: MazeTileKind | undefined,
  now: number,
  maze: MazeState,
  x: number,
  y: number,
): { player: PlayerState; event?: MazeMoveResult["event"]; collectedTreasures: Record<string, boolean> } {
  const nextMaze = player.maze ? { ...player.maze } : undefined;
  if (!nextMaze) return { player, collectedTreasures: { ...maze.collectedTreasures } };
  let nextScore = player.score;
  let nextStarDust = player.starDust ?? 0;
  let event: MazeMoveResult["event"];
  const collectedTreasures = { ...maze.collectedTreasures };
  if (tile === "key") nextMaze.keys += 1, event = "key";
  if (tile === "treasure" && nextMaze.keys > 0 && !collectedTreasures[mazePositionKey(x, y)]) {
    nextMaze.keys -= 1;
    nextStarDust += MAZE_TREASURE_STAR_DUST;
    collectedTreasures[mazePositionKey(x, y)] = true;
    event = "treasure";
  }
  if (tile === "trap") {
    nextScore = Math.max(0, nextScore - MAZE_TRAP_SCORE_PENALTY);
    event = "trap";
  }
  if (tile === "shield") {
    nextMaze.shieldUntil = Math.max(nextMaze.shieldUntil, now + 10_000);
    event = "shield";
  }
  if (tile === "spawn") nextMaze.spawnProtectedUntil = now + MAZE_SPAWN_PROTECTION_MS;
  if (tile === "teleport") {
    const destination = teleportDestination(maze, x, y);
    if (destination) {
      nextMaze.x = destination[0];
      nextMaze.y = destination[1];
      event = "teleport";
    }
  }
  return {
    player: { ...player, score: nextScore, starDust: nextStarDust, maze: nextMaze },
    event,
    collectedTreasures,
  };
}

function applyMazeEncounter(
  state: RoomState,
  players: Record<string, PlayerState>,
  moverId: string,
  now: number,
): {
  mover: PlayerState;
  target?: PlayerState;
  targetId?: string;
  targetNickname?: string;
  transferred: number;
  blockedByShield: boolean;
  blockedBySpawnProtection: boolean;
  event?: MazeMoveResult["event"];
  pairCooldowns: Record<string, number>;
} {
  const mover = players[moverId];
  const moverMaze = mover.maze;
  const pairCooldowns = { ...(state.maze?.pairCooldowns ?? {}) };
  if (!moverMaze || moverMaze.lastFastAnswerAt === undefined ||
    now - moverMaze.lastFastAnswerAt > MAZE_FAST_AUTHORITY_WINDOW_MS ||
    now < moverMaze.spawnProtectedUntil) {
    return { mover, transferred: 0, blockedByShield: false, blockedBySpawnProtection: false, pairCooldowns };
  }
  const candidate = Object.values(players)
    .filter((player) => player.id !== moverId && player.maze)
    .filter((player) => state.playStyle !== "team" || player.teamId !== mover.teamId)
    .filter((player) => Math.abs(player.maze!.x - moverMaze.x) + Math.abs(player.maze!.y - moverMaze.y) <= 1)
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  if (!candidate?.maze) return { mover, transferred: 0, blockedByShield: false, blockedBySpawnProtection: false, pairCooldowns };
  const pair = [moverId, candidate.id].sort().join(":");
  if ((pairCooldowns[pair] ?? 0) > now) {
    return { mover, transferred: 0, blockedByShield: false, blockedBySpawnProtection: false, pairCooldowns };
  }
  pairCooldowns[pair] = now + MAZE_PAIR_COOLDOWN_MS;
  if (candidate.maze.shieldUntil > now || candidate.maze.spawnProtectedUntil > now) {
    return {
      mover,
      target: candidate,
      targetId: candidate.id,
      targetNickname: candidate.nickname,
      transferred: 0,
      blockedByShield: candidate.maze.shieldUntil > now,
      blockedBySpawnProtection: candidate.maze.spawnProtectedUntil > now,
      event: "encounter",
      pairCooldowns,
    };
  }
  const amount = Math.min(Math.floor(candidate.score * 0.1), 40, candidate.starDust ?? 0);
  if (amount <= 0) {
    return { mover, target: candidate, targetId: candidate.id, targetNickname: candidate.nickname, transferred: 0, blockedByShield: false, blockedBySpawnProtection: false, pairCooldowns };
  }
  const target = { ...candidate, starDust: (candidate.starDust ?? 0) - amount };
  const nextMover = { ...mover, starDust: (mover.starDust ?? 0) + amount };
  return {
    mover: nextMover,
    target,
    targetId: target.id,
    targetNickname: target.nickname,
    transferred: amount,
    blockedByShield: false,
    blockedBySpawnProtection: false,
    event: "encounter",
    pairCooldowns,
  };
}

function createTreasureChoices(
  state: RoomState,
  playerId: string,
  occurrenceIndex: number,
): TreasureChoice[] {
  const targetIds = shuffled(
    Object.keys(state.players).filter((candidate) => candidate !== playerId),
    `${state.code}:${playerId}:${occurrenceIndex}:treasure-target`,
  );
  const riskIsLoot = targetIds.length > 0 &&
    hashString(`${state.code}:${playerId}:${occurrenceIndex}:treasure-risk`) % 2 === 0;
  return ([
    { strategy: "safe", kind: "safe_bonus", amount: TREASURE_SAFE_BONUS },
    { strategy: "team", kind: "share", amount: TREASURE_SHARE_AMOUNT },
    {
      strategy: "risk",
      kind: riskIsLoot ? "loot" : "trap",
      amount: riskIsLoot ? TREASURE_LOOT_AMOUNT : TREASURE_TRAP_AMOUNT,
    },
  ] as const).map((spec, index) => {
    const choice: TreasureChoice = {
      id: `treasure-${hashString(`${state.code}:${playerId}:${occurrenceIndex}:${index}`).toString(36)}-${index}`,
      strategy: spec.strategy,
      kind: spec.kind,
      amount: spec.amount,
    };
    if (spec.kind === "loot") choice.targetPlayerId = targetIds[0];
    return choice;
  });
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
