import { ApiError, createRoomSocket, roomApi } from "./api.js";

const SESSION_PLAYER_ID = "mg.multiplayer.playerId";
const SESSION_RESUME_TOKEN = "mg.multiplayer.resumeToken";
const LOCAL_SET_KEY = "mg.multiplayer.localSet";
const TEACHER_SETUP_KEY = "mg.multiplayer.teacherSetup";

const UNIT_OPTIONS = {
  g1: [
    ["g1-l1-be-verb", "L1 · be동사"],
    ["g1-l1-general-verb", "L1 · 일반동사"],
    ["g1-l2-present-progressive", "L2 · 현재진행형"],
    ["g1-l2-gerund", "L2 · 동명사"],
    ["g1-l3-past-tense", "L3 · be·일반동사 과거형"],
    ["g1-l3-when", "L3 · when"],
    ["g1-l4-to-infinitive", "L4 · to부정사"],
    ["g1-l4-will-should", "L4 · will / should"],
    ["g1-l5-reflexive", "L5 · 재귀대명사"],
    ["g1-l5-to-infinitive", "L5 · 목적의 to부정사"],
    ["g1-l6-sensory-verbs", "L6 · 감각동사"],
    ["g1-l6-because", "L6 · because"],
    ["g1-l7-make-adjective", "L7 · make+형용사"],
    ["g1-l7-that", "L7 · 접속사 that"],
    ["g1-l8-exclamation", "L8 · 감탄문"],
    ["g1-l8-something-adjective", "L8 · -thing+형용사"],
  ],
  g2: [
    ["g2-l1-give", "L1 · 수여동사"],
    ["g2-l1-relative-pronoun", "L1 · 관계대명사"],
    ["g2-l2-present-perfect", "L2 · 현재완료"],
    ["g2-l2-comparative", "L2 · 비교급·최상급"],
    ["g2-l3-adjective-to-infinitive", "L3 · 형용사 to부정사"],
    ["g2-l3-if", "L3 · if"],
    ["g2-l4-so-that", "L4 · so~that"],
    ["g2-l4-passive", "L4 · 수동태"],
    ["g2-l5-object-to-infinitive", "L5 · 동사+목적어+to부정사"],
    ["g2-l5-object-relative-pronoun", "L5 · 목적격 관계대명사"],
    ["g2-l6-perception-verb", "L6 · 지각동사"],
    ["g2-l6-indirect-question", "L6 · 간접의문문"],
    ["g2-l7-causative", "L7 · 사역동사"],
    ["g2-l7-as-as", "L7 · 원급 비교"],
    ["g2-l8-dummy-it", "L8 · 가주어 it"],
    ["g2-l8-wh-to-infinitive", "L8 · 의문사+to부정사"],
  ],
};

const GAME_MODES = [
  { value: "score_race", title: "스피드 점수전", description: "문제를 빠르게 풀고 순위를 겨뤄요.", tag: "개인 경쟁", image: "./assets/cover-score-v2.webp" },
  { value: "treasure_heist", title: "금고 작전", description: "정답 뒤 금고를 골라 보상을 얻어요.", tag: "선택형", image: "./assets/cover-vault-v2.webp" },
  { value: "maze_heist", title: "미궁 쟁탈전", description: "문제를 맞히고 미궁을 탐험해요.", tag: "탐험형", image: "./assets/cover-maze-v2.webp" },
  { value: "grammar_escape", title: "야간학교 탈출", description: "단서를 모아 세 개의 문을 열어요.", tag: "협동 가능", image: "./assets/cover-escape-v2.webp" },
];

const app = document.querySelector("#app");
const statusRegion = document.querySelector("#status");
const connectionBadge = document.querySelector("#connection-badge");
const initialParams = new URLSearchParams(location.search);
const initialTeacherIntent = initialParams.get("teacher") === "1";
const initialAuthError = initialParams.get("auth_error") || "";
const initialTeacherDraft = loadTeacherDraft();

const state = {
  view: "role",
  role: null,
  roomCode: sanitizeCode(initialParams.get("room") || ""),
  room: null,
  roomConfig: null,
  report: null,
  playerId: null,
  resumeToken: null,
  socket: null,
  busy: false,
  chosenAnswer: null,
  pendingQuestionKey: null,
  feedback: null,
  connectionState: "idle",
  teacherLoginRequired: false,
  teacherSession: null,
  teacherAuthLoading: false,
  teacherSetupDraft: initialTeacherDraft,
  teacherSetupStep: initialTeacherDraft?.mode ? 2 : 1,
  selectedGameMode: initialTeacherDraft?.mode || "",
  unitSearch: "",
  clockTimer: null,
  renderedQuestionKey: null,
  needsQuestionFocus: false,
  localSet: initialTeacherDraft?.customSet || (initialParams.get("set") === "local" ? loadLocalSet() : null),
  treasureBusy: false,
  mazeBusy: false,
  escapeBusy: false,
  escapeAction: null,
  escapeCode: "",
  escapeQuestionOpen: true,
};

function isLoopback() {
  return ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
}

function loadTeacherDraft() {
  try {
    const draft = JSON.parse(sessionStorage.getItem(TEACHER_SETUP_KEY) || "null");
    return draft && typeof draft === "object" ? draft : null;
  } catch {
    return null;
  }
}

function clearTeacherDraft() {
  state.teacherSetupDraft = null;
  sessionStorage.removeItem(TEACHER_SETUP_KEY);
}

function oauthErrorMessage(code) {
  return ({
    access_denied: "Google 로그인이 취소되었어요. 다시 시도해 주세요.",
    oauth_denied: "Google 로그인이 취소되었어요. 다시 시도해 주세요.",
    oauth_failed: "Google 로그인을 완료하지 못했어요. 다시 시도해 주세요.",
    oauth_expired: "로그인 확인 시간이 지났어요. 다시 시도해 주세요.",
    oauth_state_invalid: "로그인 확인을 다시 시작해 주세요.",
    teacher_not_allowed: "이 Google 계정은 교사 계정으로 등록되어 있지 않아요.",
  })[String(code || "").toLowerCase()] || "Google 로그인을 완료하지 못했어요. 다시 시도해 주세요.";
}

function removeAuthQuery() {
  const url = new URL(location.href);
  url.searchParams.delete("teacher");
  url.searchParams.delete("auth_error");
  history.replaceState({}, "", url);
}

function teacherReturnTo() {
  const url = new URL(location.href);
  url.searchParams.set("teacher", "1");
  url.searchParams.delete("auth_error");
  return `${url.pathname}${url.search}`;
}

function loadLocalSet() {
  try {
    const set = JSON.parse(localStorage.getItem(LOCAL_SET_KEY) || "null");
    if (!set || !Array.isArray(set.questions) || set.questions.length < 5) return null;
    return {
      title: String(set.title || "내 퀴즈 세트").trim().slice(0, 80),
      questions: set.questions.slice(0, 30),
    };
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sanitizeCode(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function safeImageUrl(value) {
  if (!value) return "";
  if (/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(value) && value.length <= 400_000) {
    return value;
  }
  try {
    const url = new URL(value, location.href);
    return ["http:", "https:"].includes(url.protocol) ? escapeHtml(url.href) : "";
  } catch {
    return "";
  }
}

function setStatus(message = "", tone = "") {
  statusRegion.textContent = message;
  statusRegion.dataset.tone = tone;
}

function clearStaleStudentPlayStatus() {
  if (!statusRegion || state.role !== "student" || roomStatus() !== "playing") return;
  const message = statusRegion.textContent || "";
  if (["참가 완료", "게임 진행 중", "게임방에 다시 연결"].some((prefix) => message.startsWith(prefix))) setStatus();
}

function setConnection(name) {
  const labels = {
    idle: "준비",
    connecting: "연결 중",
    connected: "연결됨",
    reconnecting: "재연결 중",
    error: "연결 확인",
    exhausted: "연결 끊김",
    rejected: "재접속 만료",
    closed: "종료",
  };
  connectionBadge.dataset.state = name;
  connectionBadge.textContent = labels[name] || "연결 확인";
  state.connectionState = name;
}

function parseRoom(payload) {
  return payload?.state || payload?.room || payload || null;
}

function applyRoom(payload) {
  const room = parseRoom(payload);
  if (!room) return null;
  const metadata = state.roomConfig || {};
  return {
    ...metadata,
    ...room,
    grade: room.grade || metadata.grade,
    unitKey: room.unitKey || room.unit_key || metadata.unitKey,
    durationSeconds: Number(room.durationSeconds ?? room.duration_seconds ?? metadata.durationSeconds ?? 0),
    questionCount: Number(room.questionCount ?? room.question_count ?? metadata.questionCount ?? 0),
    allowLateJoin: room.allowLateJoin ?? room.allow_late_join ?? metadata.allowLateJoin ?? true,
    shuffleQuestions: room.shuffleQuestions ?? room.shuffle_questions ?? metadata.shuffleQuestions ?? true,
    mode: room.mode || metadata.mode || "score_race",
    setTitle: room.setTitle || room.set_title || metadata.setTitle || "",
    playStyle: room.playStyle || room.play_style || metadata.playStyle || "individual",
    teamCount: Number(room.teamCount ?? room.team_count ?? metadata.teamCount ?? 0),
  };
}

function roomStatus(room = state.room) {
  const value = room?.status || room?.phase || "waiting";
  if (["active", "started", "playing", "in_progress"].includes(value)) return "playing";
  if (["finished", "ended", "complete"].includes(value)) return "finished";
  return "waiting";
}

function roomPlayers(room = state.room) {
  const values = room?.leaderboard || room?.players || room?.participants || [];
  return Array.isArray(values) ? values : [];
}

function playerId(player) {
  return player?.id || player?.playerId || player?.player_id || "";
}

function playerName(player) {
  return player?.nickname || player?.name || "학생";
}

function playerScore(player) {
  return Number(player?.score || 0);
}

function playerCorrect(player) {
  return Number(player?.correctCount ?? player?.correct_count ?? player?.correct ?? 0);
}

function playerAnswered(player) {
  return Number(player?.answeredCount ?? player?.answered_count ?? player?.answered ?? player?.totalAnswered ?? 0);
}

function playerAccuracy(player) {
  if (Number.isFinite(Number(player?.accuracy))) {
    const value = Number(player.accuracy);
    return value <= 1 ? Math.round(value * 100) : Math.round(value);
  }
  const answered = playerAnswered(player);
  return answered ? Math.round((playerCorrect(player) / answered) * 100) : 0;
}

function playerAverageMs(player) {
  return Math.round(Number(player?.avgResponseMs ?? player?.averageResponseMs ?? player?.averageResponseTimeMs ?? player?.average_response_time_ms ?? 0));
}

function currentPlayer(room = state.room) {
  return room?.self || room?.me || roomPlayers(room).find((player) => player?.isSelf || playerId(player) === state.playerId) || null;
}

function sortedPlayers(room = state.room) {
  return [...roomPlayers(room)].sort((a, b) => {
    if (playerScore(b) !== playerScore(a)) return playerScore(b) - playerScore(a);
    if (playerAccuracy(b) !== playerAccuracy(a)) return playerAccuracy(b) - playerAccuracy(a);
    if (playerCorrect(b) !== playerCorrect(a)) return playerCorrect(b) - playerCorrect(a);
    return playerAverageMs(a) - playerAverageMs(b);
  });
}

function sortedEscapePlayers(players = roomPlayers()) {
  const values = [...players];
  if (values.some((player) => Number(player?.rank) > 0)) {
    return values.sort((a, b) => (Number(a?.rank) || Number.MAX_SAFE_INTEGER) - (Number(b?.rank) || Number.MAX_SAFE_INTEGER));
  }
  return values.sort((a, b) => {
    const first = escapeRecord(a);
    const second = escapeRecord(b);
    const firstEscaped = Boolean(first.escapedAt);
    const secondEscaped = Boolean(second.escapedAt);
    if (firstEscaped !== secondEscaped) return firstEscaped ? -1 : 1;
    if (firstEscaped && Number(first.escapedAt) !== Number(second.escapedAt)) return Number(first.escapedAt) - Number(second.escapedAt);
    if (Number(first.roomsCleared || 0) !== Number(second.roomsCleared || 0)) return Number(second.roomsCleared || 0) - Number(first.roomsCleared || 0);
    if (Number(first.discoveredCount || 0) !== Number(second.discoveredCount || 0)) return Number(second.discoveredCount || 0) - Number(first.discoveredCount || 0);
    if (playerScore(a) !== playerScore(b)) return playerScore(b) - playerScore(a);
    return playerAccuracy(b) - playerAccuracy(a);
  });
}

function sortedEscapeTeams(teams = teamLeaderboard()) {
  const values = [...teams];
  if (values.some((team) => Number(team?.rank) > 0)) {
    return values.sort((a, b) => (Number(a?.rank) || Number.MAX_SAFE_INTEGER) - (Number(b?.rank) || Number.MAX_SAFE_INTEGER));
  }
  return sortedEscapePlayers(values);
}

function playerRank(player, room = state.room) {
  if (Number(player?.rank) > 0) return Number(player.rank);
  const index = sortedPlayers(room).findIndex((item) => playerId(item) === playerId(player));
  return index >= 0 ? index + 1 : 0;
}

function currentQuestion(room = state.room) {
  return room?.self?.currentQuestion || room?.self?.current_question || room?.currentQuestion || room?.question || room?.current_question || null;
}

function questionId(question) {
  return question?.id || question?.questionId || "";
}

function questionOccurrenceIndex(question = currentQuestion(), player = currentPlayer()) {
  const value = Number(
    question?.occurrenceIndex ?? question?.occurrence_index ?? player?.answeredCount ?? player?.answered_count ?? 0,
  );
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function questionOccurrenceKey(question = currentQuestion(), player = currentPlayer()) {
  const id = questionId(question);
  const index = questionOccurrenceIndex(question, player);
  return id && index !== null ? `${index}:${id}` : "";
}

function getProgress(room = state.room) {
  const question = currentQuestion(room);
  const current = Number(
    question?.index ?? room?.currentQuestionIndex ?? room?.progress?.current ?? currentPlayer(room)?.answeredCount ?? 0,
  );
  const total = Number(question?.total ?? room?.questionCount ?? room?.progress?.total ?? 0);
  return { current: Math.max(0, current), total: Math.max(0, total) };
}

function selectedUnitLabel(room = state.room) {
  const customTitle = room?.setTitle || room?.set_title || state.roomConfig?.setTitle;
  if (customTitle) return customTitle;
  const grade = room?.grade || room?.room?.grade || state.roomConfig?.grade || "g1";
  const unitKey = room?.unitKey || room?.unit_key || room?.unit || room?.room?.unit_key || state.roomConfig?.unitKey || "";
  return UNIT_OPTIONS[grade]?.find(([key]) => key === unitKey)?.[1] || room?.unitLabel || unitKey || "문법 종합";
}

function roomMode(room = state.room) {
  return room?.mode || state.roomConfig?.mode || "score_race";
}

function isTeamMode(room = state.room) {
  return (room?.playStyle || room?.play_style || state.roomConfig?.playStyle || "individual") === "team";
}

function teamLeaderboard(room = state.room) {
  const teams = room?.teamLeaderboard || room?.team_leaderboard || [];
  return Array.isArray(teams) ? teams : [];
}

function currentTeam(room = state.room) {
  if (!isTeamMode(room)) return null;
  const self = currentPlayer(room);
  const teams = teamLeaderboard(room);
  return room?.team || teams.find((team) => team?.isSelf || (self?.teamId && team.teamId === self.teamId)) || null;
}

function soloGameUrl() {
  const mainSiteOrigin = location.hostname.endsWith("workers.dev")
    ? "https://middle-grammar.vercel.app"
    : location.origin;
  return new URL("/game/", mainSiteOrigin).href;
}

function teamBadgeHtml(room = state.room) {
  if (!isTeamMode(room)) return "";
  const team = currentTeam(room);
  const number = Number(team?.teamNumber || currentPlayer(room)?.teamNumber || 0);
  return `<span class="tag team-badge">🛡️ ${number ? `${number}팀` : "팀 배정 완료"}</span>`;
}

function modeLabel(mode = roomMode()) {
  return ({
    score_race: "스피드 점수전",
    treasure_heist: "금고 작전",
    maze_heist: "미궁 쟁탈전",
    grammar_escape: "야간학교 탈출",
  })[mode] || "멀티 게임";
}

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(Math.floor(safe % 60)).padStart(2, "0")}`;
}

function remainingSeconds(room = state.room) {
  const durationSeconds = Number(room?.durationSeconds ?? room?.duration_seconds ?? 0);
  const startedAt = Number(room?.startedAt ?? room?.started_at ?? 0);
  return startedAt
    ? Math.max(0, Math.ceil((startedAt + durationSeconds * 1000 - Date.now()) / 1000))
    : durationSeconds;
}

function updateClock() {
  const timer = document.querySelector("#game-timer");
  if (timer) timer.textContent = formatTime(remainingSeconds());
  const retry = document.querySelector("[data-escape-retry]");
  if (retry) {
    const escape = escapeState();
    const seconds = escapeRetrySeconds(escape);
    retry.disabled = Number(escape?.discoveredCount || 0) !== 3 || Boolean(escape?.escapedAt)
      || seconds > 0 || state.escapeBusy || state.connectionState !== "connected";
    retry.textContent = seconds > 0 ? `${seconds}초 후 다시 시도` : state.escapeBusy ? "문을 확인하는 중…" : "문 열기";
  }
}

function ensureClock() {
  updateClock();
  if (!state.clockTimer) state.clockTimer = window.setInterval(updateClock, 1000);
}

function stopClock() {
  if (state.clockTimer) window.clearInterval(state.clockTimer);
  state.clockTimer = null;
}

function updateUrl(code) {
  const url = new URL(location.href);
  if (code) url.searchParams.set("room", code);
  else url.searchParams.delete("room");
  history.replaceState({}, "", url);
}

function saveStudentCredentials(player, token) {
  sessionStorage.setItem(SESSION_PLAYER_ID, player);
  sessionStorage.setItem(SESSION_RESUME_TOKEN, token);
}

function clearStudentCredentials() {
  sessionStorage.removeItem(SESSION_PLAYER_ID);
  sessionStorage.removeItem(SESSION_RESUME_TOKEN);
  state.playerId = null;
  state.resumeToken = null;
}

function resetConnection() {
  state.socket?.close();
  state.socket = null;
  setConnection("idle");
}

function resetToRole() {
  resetConnection();
  stopClock();
  state.role = null;
  state.view = "role";
  state.room = null;
  state.report = null;
  state.roomConfig = null;
  state.chosenAnswer = null;
  state.pendingQuestionKey = null;
  state.feedback = null;
  state.escapeBusy = false;
  state.escapeAction = null;
  state.escapeCode = "";
  state.escapeQuestionOpen = true;
  setStatus();
  render();
}

function friendlyError(error) {
  if (error instanceof ApiError) {
    const byCode = {
      ROOM_STARTED: "이미 시작한 방이라 새로 들어갈 수 없어요.",
      ROOM_NOT_FOUND: "방 번호를 다시 확인해 주세요.",
      DUPLICATE_NICKNAME: "같은 이름이 있어요. 다른 닉네임을 써 주세요.",
      DUPLICATE_ANSWER: "이 문제에는 이미 답했어요.",
      INVALID_RESUME_TOKEN: "재접속 시간이 지났어요. 선생님께 알려 주세요.",
      RECONNECT_EXPIRED: "재접속 가능한 60초가 지났어요. 선생님께 알려 주세요.",
      MAZE_MOVE_BLOCKED: "그쪽은 벽이에요. 다른 방향으로 가 보세요.",
      MAZE_NO_MOVES: "이동권이 없어요. 문제를 맞혀 이동권을 얻으세요.",
      DUPLICATE_MAZE_MOVE: "이미 처리한 이동이에요. 서버 위치를 다시 확인했어요.",
      MAZE_MOVE_OUT_OF_ORDER: "이동 순서가 어긋났어요. 잠시 뒤 다시 움직여 주세요.",
      INVALID_ESCAPE_ACTION: "조사할 곳이나 암호를 다시 확인해 주세요.",
      ESCAPE_ACTION_OUT_OF_ORDER: "팀 진행이 먼저 바뀌었어요. 최신 단서를 확인해 주세요.",
      ESCAPE_NO_FOCUS: "문제를 맞혀 조사 기회를 먼저 얻어야 해요.",
      ESCAPE_LOCKED: "세 단서를 모두 찾아야 문을 열 수 있어요.",
      ESCAPE_RETRY_ACTIVE: "자물쇠가 잠시 멈췄어요. 3초 뒤에 다시 시도해 주세요.",
      ESCAPE_COMPLETE: "이미 야간학교를 탈출했어요.",
    };
    return byCode[error.code] || error.message;
  }
  return error?.message || "알 수 없는 오류가 생겼어요.";
}

function teacherAccountHtml() {
  const teacher = state.teacherSession?.teacher;
  if (!teacher?.email) return isLoopback() ? `<span class="teacher-account local">로컬 교사 테스트</span>` : "";
  const role = teacher.role === "admin" ? "관리자" : teacher.role === "teacher" ? "교사" : "";
  return `<div class="teacher-account"><span><strong>${escapeHtml(teacher.email)}</strong>${role ? `<small class="teacher-role">${role}</small>` : ""}</span><button class="text-button" type="button" data-action="teacher-logout">로그아웃</button></div>`;
}

function teacherAuthGateView() {
  if (state.teacherAuthLoading) {
    return `<section class="screen teacher-auth-gate teacher-auth-neutral" aria-live="polite"><h1>교사 로그인 확인 중</h1><p>안전하게 교사 권한을 확인하고 있어요.</p></section>`;
  }
  const configured = state.teacherSession?.configured;
  if (configured === false) {
    return `<section class="screen teacher-auth-gate teacher-auth-neutral"><h1>로그인 연결 준비 중</h1><p>교사 로그인 연결을 준비하고 있어요. 잠시 뒤 다시 확인해 주세요.</p><button class="secondary-button" type="button" data-action="back-role">뒤로</button></section>`;
  }
  return `<section class="screen teacher-auth-gate teacher-auth-neutral"><h1>교사 로그인</h1><p>Google 교사 계정으로 로그인하면 게임방을 만들고 진행을 관리할 수 있어요.</p><button class="primary-button" type="button" data-action="teacher-login">Google로 로그인</button><button class="back-button" type="button" data-action="back-role">뒤로</button></section>`;
}

function isTeacherAuthenticated() {
  return Boolean(state.teacherSession?.authenticated) || isLoopback();
}

async function loadTeacherSession({ quiet = false } = {}) {
  state.teacherAuthLoading = true;
  if (!quiet) render();
  try {
    state.teacherSession = await roomApi.getTeacherSession();
    state.teacherLoginRequired = !state.teacherSession?.authenticated;
    return state.teacherSession;
  } catch (error) {
    state.teacherSession = { authenticated: false, configured: false };
    state.teacherLoginRequired = true;
    if (!quiet) setStatus("교사 로그인 상태를 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.", "error");
    return state.teacherSession;
  } finally {
    state.teacherAuthLoading = false;
    if (!quiet) render();
  }
}

function handleTeacherAuthError(error) {
  if (!(error instanceof ApiError) || ![401, 403].includes(error.status)) return false;
  resetConnection();
  stopClock();
  state.room = null;
  state.report = null;
  state.busy = false;
  state.teacherSession = { authenticated: false, configured: state.teacherSession?.configured !== false };
  state.teacherLoginRequired = true;
  setStatus("교사 로그인 시간이 끝났어요. Google로 다시 로그인해 주세요.", "error");
  render();
  return true;
}

function saveTeacherDraft() {
  const form = document.querySelector("#create-form");
  if (!form) return;
  const draft = { customSet: state.localSet || null };
  new FormData(form).forEach((value, key) => {
    draft[key] = String(value);
  });
  draft.allowLateJoin = form.elements.allowLateJoin?.checked === true;
  draft.shuffleQuestions = form.elements.shuffleQuestions?.checked === true;
  state.teacherSetupDraft = draft;
  sessionStorage.setItem(TEACHER_SETUP_KEY, JSON.stringify(draft));
}

function applyTeacherDraft() {
  const draft = state.teacherSetupDraft;
  if (!draft || !document.querySelector("#create-form")) return;
  if (!state.localSet && draft.customSet) state.localSet = draft.customSet;
  const grade = String(draft.grade || "g1");
  const board = document.querySelector("#unit-board");
  if (board && UNIT_OPTIONS[grade]) board.innerHTML = unitBoardHtml(grade, String(draft.unitKey || ""), state.unitSearch);
  Object.entries(draft).forEach(([name, value]) => {
    if (name === "customSet") return;
    const inputs = app.querySelectorAll(`[name="${CSS.escape(name)}"]`);
    inputs.forEach((input) => {
      if (input.type === "checkbox") input.checked = Boolean(value);
      else if (input.type === "radio") input.checked = input.value === String(value);
      else input.value = String(value);
    });
  });
  clearTeacherDraft();
  toggleTeamSettings();
  refreshMissionSummary();
}

function connectLiveRoom() {
  resetConnection();
  state.socket = createRoomSocket({
    getUrl: async () => {
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      if (state.role === "teacher") {
        const url = new URL(`/api/teacher/rooms/${encodeURIComponent(state.roomCode)}/ws`, location.origin);
        url.protocol = protocol;
        if (["localhost", "127.0.0.1", "::1"].includes(location.hostname)) {
          url.searchParams.set("devTeacherEmail", "teacher@local.test");
        }
        return url.toString();
      }
      const payload = await roomApi.createSocketTicket(
        state.roomCode,
        state.playerId,
        state.resumeToken,
      );
      if (!payload.ticket) throw new ApiError("재접속 확인 정보를 받지 못했어요.", 0, "SOCKET_TICKET_FAILED");
      const url = new URL(`/api/rooms/${encodeURIComponent(state.roomCode)}/ws`, location.origin);
      url.protocol = protocol;
      url.searchParams.set("ticket", payload.ticket);
      return url.toString();
    },
    onMessage: handleSocketMessage,
    onStatus: ({ name, attempt, maxReconnects, reason }) => {
      setConnection(name);
      if (["reconnecting", "closed", "exhausted", "rejected"].includes(name)) {
        state.escapeBusy = false;
        state.escapeAction = null;
      }
      if (state.role === "teacher" && name === "rejected") {
        state.room = null;
        state.report = null;
        state.busy = false;
        state.teacherSession = { authenticated: false, configured: state.teacherSession?.configured !== false };
        state.teacherLoginRequired = true;
        setStatus("교사 로그인 시간이 끝났어요. Google로 다시 로그인해 주세요.", "error");
        render();
        return;
      }
      if (name === "reconnecting") {
        setStatus(`연결을 다시 확인하고 있어요 (${attempt}/${maxReconnects}).`);
      } else if (name === "connected") {
        if (statusRegion.textContent.includes("연결")) setStatus();
      } else if (name === "exhausted") {
        setStatus("서버와 연결이 끊겼어요. 페이지를 새로고침해 주세요.", "error");
      } else if (name === "rejected") {
        setStatus(reason || "재접속 시간이 지났어요. 선생님께 알려 주세요.", "error");
      }
      if (["exhausted", "rejected"].includes(name)) render();
    },
  });
}

function handleSocketMessage(message) {
  const type = message?.type;
  if (type === "hello") {
    const previousEscape = escapeState();
    const room = applyRoom(message);
    if (room && room !== message) {
      state.room = room;
      syncEscapeCode(previousEscape, escapeState());
    }
    state.escapeBusy = false;
    state.escapeAction = null;
    clearStaleStudentPlayStatus();
  } else if (type === "room_state" || type === "start") {
    const previousEscape = escapeState();
    const previousQuestionKey = questionOccurrenceKey();
    state.room = applyRoom(message);
    syncEscapeCode(previousEscape, escapeState());
    const nextQuestionKey = questionOccurrenceKey();
    if (type === "start" || (state.pendingQuestionKey && previousQuestionKey !== nextQuestionKey)) {
      state.pendingQuestionKey = null;
      state.chosenAnswer = null;
    }
    if (type === "start") state.feedback = null;
    if (type === "start") {
      if (state.role === "student") setStatus();
      else setStatus("게임 진행 중", "success");
    }
  } else if (type === "answer_result") {
    const result = message.result || message;
    if (message.state || message.room) state.room = applyRoom(message);
    const resultIndex = Number(result.occurrenceIndex ?? result.occurrence_index);
    state.feedback = {
      occurrenceKey: Number.isInteger(resultIndex) && resultIndex >= 0
        ? `${resultIndex}:${result.questionId}`
        : state.pendingQuestionKey,
      correct: Boolean(result.correct ?? result.isCorrect),
      points: Number(result.scoreGain ?? result.points ?? result.scoreDelta ?? 0),
      answer: result.answer ?? result.correctAnswer ?? "",
      selectedAnswer: state.chosenAnswer,
    };
    state.pendingQuestionKey = null;
    state.chosenAnswer = null;
    state.busy = false;
  } else if (type === "treasure_result") {
    const result = message.result || message;
    if (message.state || message.room) state.room = applyRoom(message);
    const messages = {
      safe_bonus: `안전 금고! +${Number(result.amount || 0).toLocaleString()}점`,
      loot: `${result.targetNickname ? `${result.targetNickname}에게서 ` : ""}${Number(result.amount || 0).toLocaleString()}점을 가져왔어요!`,
      share: `모두에게 ${Number(result.amount || 0).toLocaleString()}점씩 나눴어요.`,
      trap: `함정! ${Number(result.amount || 0).toLocaleString()}점을 잃었어요.`,
    };
    state.feedback = { treasureMessage: messages[result.kind] || "금고 결과가 반영됐어요." };
    state.treasureBusy = false;
    setStatus("금고 결과가 점수에 반영됐어요.", result.kind === "trap" ? "" : "success");
  } else if (type === "maze_move_result") {
    const result = message.result || message;
    if (message.state || message.room) state.room = applyRoom(message);
    const eventMessages = {
      key: "열쇠를 찾았어요! 보물 봉인을 열 수 있어요.",
      treasure: "숨겨진 보물을 발견했어요! 별가루를 획득했습니다.",
      trap: "함정 발동! 점수를 조금 잃었어요.",
      teleport: "공간 이동 장치가 작동했어요!",
      shield: "방패 획득! 다음 약탈을 막아 줍니다.",
      encounter: result.blockedByShield
        ? `${result.targetNickname || "상대"}의 방패가 약탈을 막았어요.`
        : result.blockedBySpawnProtection
          ? "상대가 시작 보호 중이라 안전하게 지나갔어요."
          : `${result.targetNickname || "상대"}에게서 별가루 ${Number(result.starDustTransferred || 0)}개를 가져왔어요!`,
    };
    state.feedback = {
      ...(state.feedback || {}),
      mazeMessage: eventMessages[result.event] || "미궁에서 한 칸 이동했어요.",
      mazeTone: result.event === "trap" ? "wrong" : "correct",
    };
    state.mazeBusy = false;
    setStatus("서버 위치를 확인했어요.", result.event === "trap" ? "" : "success");
  } else if (type === "escape_result") {
    const previousEscape = escapeState();
    if (message.room || message.state) state.room = applyRoom(message);
    const result = message.result || {};
    const action = state.escapeAction;
    const retryActive = action === "unlock" && escapeRetrySeconds(escapeState()) > 0;
    syncEscapeCode(previousEscape, escapeState());
    state.escapeBusy = false;
    state.escapeAction = null;
    state.feedback = { ...(state.feedback || {}), escapeMessage: result.message || "조사가 반영됐어요.", escapeTone: retryActive ? "wrong" : "correct" };
    setStatus(result.message || "야간학교의 단서가 갱신됐어요.", retryActive ? "error" : "success");
  } else if (type === "finish") {
    state.room = applyRoom(message);
    if (state.room && !state.room.status) state.room.status = "finished";
    stopClock();
    setStatus("게임 종료", "success");
    if (state.role === "teacher") loadTeacherReport();
  } else if (type === "error") {
    const error = new ApiError(message.message || "게임 요청을 처리하지 못했어요.", 0, message.code || message.error);
    if (message.room || message.state) state.room = applyRoom(message);
    setStatus(friendlyError(error), "error");
    if (message.error === "DUPLICATE_ANSWER") {
      state.pendingQuestionKey = null;
      state.chosenAnswer = null;
    }
    state.treasureBusy = false;
    state.mazeBusy = false;
    state.escapeBusy = false;
    state.escapeAction = null;
    state.busy = false;
  }
  render();
}

function reconnectPanel() {
  if (!state.room || !["exhausted", "rejected"].includes(state.connectionState)) return "";
  const rejected = state.connectionState === "rejected";
  return `<div class="reconnect-panel" role="alert">
    <span>${rejected ? "재접속 시간이 끝났어요. 선생님께 알려 주세요." : "연결이 끊겼어요."}</span>
    <button class="secondary-button" type="button" data-action="${rejected ? "leave-room" : "retry-connection"}">${rejected ? "나가기" : "다시 연결"}</button>
  </div>`;
}

function roleChooser() {
  return `
    <section class="screen" aria-labelledby="welcome-title">
      <div class="hero">
        <p class="eyebrow">LIVE CLASSROOM GAME</p>
        <h1 id="welcome-title">친구들과 <span class="hero-highlight">문법 대결!</span></h1>
        <p class="lead">번호로 바로 들어가거나, 선생님이 새 게임방을 열 수 있어요.</p>
      </div>
      <div class="role-grid">
        <button class="role-card student" type="button" data-action="choose-student">
          <span class="role-icon" aria-hidden="true">S</span>
          <span class="role-copy">
            <strong>학생으로 참가</strong>
            <span>로그인 없이 방 번호와 닉네임만 입력하면 준비 끝!</span>
            <em>${state.roomCode ? `방 ${escapeHtml(state.roomCode)} 참가하기 →` : "번호 입력하기 →"}</em>
          </span>
        </button>
        <button class="role-card teacher" type="button" data-action="choose-teacher">
          <span class="role-icon" aria-hidden="true">T</span>
          <span class="role-copy">
            <strong>교사용 게임 만들기</strong>
            <span>문법 범위와 시간을 고르고 실시간 순위를 확인해요.</span>
            <em>교사 로그인하고 만들기 →</em>
          </span>
        </button>
      </div>
      <a class="creator-cta" href="./creator.html">
        <span class="creator-cta-icon" aria-hidden="true">＋</span>
        <span><strong>내 문제로 게임 만들기</strong><small>직접 입력 · Quizlet 붙여넣기 · Excel/CSV · 사진</small></span>
        <em>제작기 열기 →</em>
      </a>
      ${state.roomCode ? `
        <button class="reopen-room-button" type="button" data-action="reopen-teacher">
          <span>교사 화면 다시 열기</span>
          <strong>방 ${escapeHtml(state.roomCode)}</strong>
        </button>` : ""}
    </section>`;
}

function studentJoinView() {
  return `
    <section class="screen panel" aria-labelledby="join-title">
      <div class="panel-header">
        <div>
          <p class="eyebrow">STUDENT JOIN</p>
          <h1 id="join-title">게임방 들어가기</h1>
        </div>
        <button class="back-button" type="button" data-action="back-role">뒤로</button>
      </div>
      <form id="join-form" class="form-grid" autocomplete="off">
        <div class="field">
          <label for="room-code">방 번호 6자리</label>
          <input id="room-code" class="room-code-input" name="roomCode" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="123456" value="${escapeHtml(state.roomCode)}" required aria-describedby="room-help">
          <p id="room-help" class="muted">선생님 화면이나 QR 링크에서 번호를 확인하세요.</p>
        </div>
        <div class="field">
          <label for="nickname">내 닉네임</label>
          <input id="nickname" name="nickname" maxlength="20" autocomplete="nickname" placeholder="예: 문법왕 민준" required>
        </div>
        <button class="primary-button" type="submit" ${state.busy ? "disabled" : ""}>${state.busy ? "들어가는 중…" : "게임방 참가하기"}</button>
      </form>
      <div class="helper-box">학생 계정은 만들지 않아요. 닉네임과 이번 게임 기록만 방에서 사용합니다.</div>
    </section>`;
}

function teacherSetupView() {
  if (!isTeacherAuthenticated()) return teacherAuthGateView();
  if (state.teacherSetupStep !== 2 || !state.selectedGameMode) return teacherGamePickerView();
  const customSet = state.localSet;
  const customCount = customSet?.questions?.length || 0;
  const selectedGame = GAME_MODES.find((game) => game.value === state.selectedGameMode) || GAME_MODES[0];
  const initialSetupSummary = customSet
    ? `${customSet.title} · ${customCount}문항 · ${formatTime(300)}`
    : `${unitLabel("g1", UNIT_OPTIONS.g1[0][0])} · 15문항 · ${formatTime(300)}`;
  return `
    <section class="screen teacher-setup" aria-labelledby="setup-title">
      <header class="teacher-setup-header">
        <div>
          <p class="setup-step-label">2단계 · 문제와 시간 설정</p>
          <h1 id="setup-title">문제와 시간 설정</h1>
          <p>수업에 맞는 문법 범위와 진행 방식을 고르세요.</p>
          ${teacherAccountHtml()}
        </div>
        <button class="back-button" type="button" data-action="back-role">뒤로</button>
      </header>
      <div class="selected-game-summary"><img src="${selectedGame.image}" alt="" width="160" height="96"><div><span>${escapeHtml(selectedGame.tag)}</span><strong>${escapeHtml(selectedGame.title)}</strong><small>${escapeHtml(selectedGame.description)}</small></div><button type="button" data-action="change-game">게임 바꾸기</button></div>
      <form id="create-form" class="teacher-config-form">
        <input type="hidden" name="mode" value="${escapeHtml(selectedGame.value)}">
        <div class="teacher-config-grid">
          <div class="teacher-config-main">
        ${customSet ? `
          <div class="custom-set-card">
            <div><span>내 문제 세트</span><strong>${escapeHtml(customSet.title)}</strong><small>${customCount}문항 · 이 브라우저에 임시 저장됨</small></div>
            <a href="./creator.html">문항 수정</a>
          </div>
          <input type="hidden" name="grade" value="custom">
          <input type="hidden" name="unitKey" value="custom-local">
          <input type="hidden" name="questionCount" value="${customCount}">
        ` : `
          <fieldset class="setup-field grade-field">
            <legend>학년</legend>
            <div class="grade-tabs">
              <label class="grade-tab">
                <input type="radio" name="grade" value="g1" checked>
                <span>중1</span>
              </label>
              <label class="grade-tab">
                <input type="radio" name="grade" value="g2">
                <span>중2</span>
              </label>
            </div>
          </fieldset>
          <fieldset class="setup-field unit-field">
            <legend>문법 찾기</legend>
            <label class="unit-search"><span class="sr-only">문법 주제 검색</span><input id="unit-search" type="search" placeholder="예: be동사, to부정사" value="${escapeHtml(state.unitSearch)}" autocomplete="off"></label>
            <div id="unit-board" class="unit-board">${unitBoardHtml("g1", "", state.unitSearch)}</div>
          </fieldset>
          <div id="mission-summary" class="mission-summary" aria-live="polite">${missionSummaryHtml({ grade: "g1", unitKey: UNIT_OPTIONS.g1[0][0], questionCount: 15, durationSeconds: 300 })}</div>
          <a class="build-set-link" href="./creator.html"><strong>원하는 문제가 없나요?</strong><span>직접 만들거나 Quizlet·Excel/CSV에서 가져오기</span></a>
        `}
          </div>
          <aside class="teacher-config-controls" aria-label="게임 진행 설정">
        <fieldset class="setup-field">
          <legend>제한 시간</legend>
          <div class="choice-grid time-choices">
            ${choicePill("durationSeconds", "60", "1분")}
            ${choicePill("durationSeconds", "180", "3분")}
            ${choicePill("durationSeconds", "300", "5분", true)}
            ${choicePill("durationSeconds", "420", "7분")}
            ${choicePill("durationSeconds", "600", "10분")}
          </div>
        </fieldset>
        ${customSet ? "" : `<fieldset class="setup-field">
          <legend>문항 수</legend>
          <div class="choice-grid question-choices">
            ${choicePill("questionCount", "10", "10문항")}
            ${choicePill("questionCount", "15", "15문항", true)}
            ${choicePill("questionCount", "20", "20문항")}
          </div>
          <p class="choice-help">제한 시간 동안 모두 풀면 처음부터 계속 나와요.</p>
        </fieldset>`}
        <fieldset class="setup-field play-style-field">
          <legend>플레이 스타일</legend>
          <div class="choice-grid play-style-grid">
            ${choicePill("playStyle", "individual", "개인전", true)}
            ${choicePill("playStyle", "team", "팀전")}
          </div>
          <p class="choice-help">개인전은 각자 점수로 경쟁하고, 팀전은 팀 점수를 함께 올려요.</p>
          <div id="team-count-field" class="team-count-field" hidden>
            <span class="field-label">팀 수</span>
            <div class="choice-grid team-count-grid">
              ${choicePill("teamCount", "2", "2팀")}
              ${choicePill("teamCount", "3", "3팀", true)}
              ${choicePill("teamCount", "4", "4팀")}
            </div>
          </div>
        </fieldset>
        <details class="setup-more">
          <summary>추가 설정</summary>
          <fieldset class="toggle-list">
          <legend class="sr-only">진행 방식</legend>
          <label class="toggle-row">
            <span><strong>중간 입장 허용</strong><small>늦게 들어오면 남은 시간만 플레이해요.</small></span>
            <input type="checkbox" name="allowLateJoin" role="switch" checked>
            <span class="toggle-control" aria-hidden="true"></span>
          </label>
          <label class="toggle-row">
            <span><strong>문제 순서 섞기</strong><small>학생마다 문제 순서를 다르게 보여 줘요.</small></span>
            <input type="checkbox" name="shuffleQuestions" role="switch" checked>
            <span class="toggle-control" aria-hidden="true"></span>
          </label>
        </fieldset>
        </details>
          </aside>
        </div>
        <div class="teacher-setup-sticky"><div id="setup-summary" aria-live="polite">${escapeHtml(initialSetupSummary)}</div><button class="primary-button" type="submit" ${state.busy ? "disabled" : ""}>${state.busy ? "게임방 만드는 중…" : "게임방 만들기"}</button></div>
      </form>
    </section>`;
}

function teacherGamePickerView() {
  return `<section class="screen teacher-game-picker" aria-labelledby="game-picker-title">
    <header class="teacher-setup-header"><div><p class="setup-step-label">1단계 · 게임 선택</p><h1 id="game-picker-title">어떤 게임을 할까요?</h1><p>수업의 분위기에 맞는 방식부터 고르세요.</p>${teacherAccountHtml()}</div><button class="back-button" type="button" data-action="back-role">뒤로</button></header>
    <div class="game-cover-grid">${GAME_MODES.map((game) => `<button class="game-cover" type="button" data-action="select-game" data-game-mode="${game.value}"><img src="${game.image}" alt="" width="320" height="200"><span class="game-cover-tag">${escapeHtml(game.tag)}</span><strong>${escapeHtml(game.title)}</strong><small>${escapeHtml(game.description)}</small></button>`).join("")}</div>
  </section>`;
}

function choicePill(name, value, label, checked = false) {
  return `<label class="choice-pill">
    <input type="radio" name="${name}" value="${value}" ${checked ? "checked" : ""} required>
    <span>${label}</span>
  </label>`;
}

function unitBoardHtml(grade, selected = "", search = "") {
  const options = UNIT_OPTIONS[grade] || [];
  const selectedKey = options.some(([value]) => value === selected) ? selected : options[0]?.[0] || "";
  const query = search.trim().toLowerCase();
  const groups = new Map();
  options.forEach(([value, label], index) => {
    const [lesson, ...topicParts] = label.split(" · ");
    const topic = topicParts.join(" · ") || label;
    if (!groups.has(lesson)) groups.set(lesson, []);
    groups.get(lesson).push({ value, topic, index, matches: !query || `${lesson} ${topic}`.toLowerCase().includes(query) });
  });
  const hasMatch = [...groups.values()].some((topics) => topics.some(({ matches }) => matches));
  const noMatch = hasMatch ? "" : `<p class="unit-empty">일치하는 문법 주제가 없어요.</p>`;
  return `${[...groups.entries()].map(([lesson, topics]) => `<section class="lesson-group" ${topics.some(({ matches }) => matches) ? "" : "hidden"}><h3>${escapeHtml(lesson)}</h3><div>${topics.map(({ value, topic, matches }) => `<label class="unit-topic" ${matches ? "" : "hidden"}><input type="radio" name="unitKey" value="${escapeHtml(value)}" ${value === selectedKey ? "checked" : ""} required><span>${escapeHtml(topic)}</span></label>`).join("")}</div></section>`).join("")}${noMatch}`;
}

function unitLabel(grade, unitKey) {
  return UNIT_OPTIONS[grade]?.find(([key]) => key === unitKey)?.[1] || "문법 종합";
}

function missionSummaryHtml({ grade = "g1", unitKey = UNIT_OPTIONS.g1[0][0], questionCount = 15, durationSeconds = 300, custom = false, title = "" } = {}) {
  const label = custom ? title || "내 문제 세트" : unitLabel(grade, unitKey);
  const gradeLabel = grade === "g2" ? "중2" : grade === "g1" ? "중1" : "내 문제";
  return `<div class="mission-summary-copy"><span>선택한 문법</span><strong>${escapeHtml(label)}</strong></div>
    <div class="mission-summary-stats"><span><b>${escapeHtml(gradeLabel)}</b> 학년</span><span><b>${Number(questionCount) || 0}</b> 문항</span><span><b>${formatTime(durationSeconds)}</b> 제한 시간</span></div>`;
}

function roomHeader(title) {
  const room = state.room || {};
  return `
    <div class="room-topline">
      <div>
        <p class="eyebrow">ROOM ${escapeHtml(state.roomCode)}</p>
        <h1>${escapeHtml(title)}</h1>
      </div>
      <button class="back-button" type="button" data-action="leave-room">나가기</button>
    </div>
    <div class="room-meta">
      <span class="tag">${escapeHtml(room.grade === "g2" ? "중2" : room.grade === "g1" ? "중1" : "내 문제")}</span>
      <span class="tag mode-tag">${escapeHtml(modeLabel())}</span>
      <span class="tag">${escapeHtml(selectedUnitLabel(room))}</span>
      ${questionBundleTag(room)}
      <span class="tag">${formatTime(room.durationSeconds ?? room.duration_seconds ?? 0)}</span>
      ${settingTags(room)}
    </div>`;
}

function settingTags(room = state.room) {
  const lateJoin = room?.allowLateJoin ?? room?.allow_late_join ?? state.roomConfig?.allowLateJoin ?? true;
  const shuffled = room?.shuffleQuestions ?? room?.shuffle_questions ?? state.roomConfig?.shuffleQuestions ?? true;
  const playStyle = room?.playStyle || room?.play_style || state.roomConfig?.playStyle || "individual";
  const teamCount = Number(room?.teamCount ?? room?.team_count ?? state.roomConfig?.teamCount ?? 0);
  const styleLabel = playStyle === "team" ? `팀전${teamCount ? ` · ${teamCount}팀` : ""}` : "개인전";
  return `<span class="tag play-style-tag">${styleLabel}</span><span class="tag">중간 입장 ${lateJoin ? "허용" : "마감"}</span>
    <span class="tag">문제 순서 ${shuffled ? "랜덤" : "고정"}</span>`;
}

function questionBundleTag(room = state.room) {
  const count = Number(room?.questionCount ?? room?.question_count ?? state.roomConfig?.questionCount ?? 0);
  return `<span class="tag">${count || "-"}문항 반복</span>`;
}

function playerChips(players) {
  if (!players.length) return `<div class="empty-state">아직 들어온 학생이 없어요.<br>방 번호나 QR을 보여 주세요.</div>`;
  return players.map((player) => `
    <span class="player-chip"><span class="player-dot" aria-hidden="true"></span>${escapeHtml(playerName(player))}</span>`).join("");
}

function studentLobbyView() {
  const players = roomPlayers();
  return `
    <section class="screen room-shell" aria-labelledby="lobby-title">
      <article class="panel centered">
        <div class="waiting-orbit" aria-hidden="true"></div>
        <p class="eyebrow">YOU ARE IN</p>
        <h1 id="lobby-title">선생님을 기다리는 중</h1>
        <p class="room-code" aria-label="방 번호 ${escapeHtml(state.roomCode)}">${escapeHtml(state.roomCode)}</p>
        <p class="lead">참가 완료! 선생님이 시작하면 문제가 바로 나타나요.</p>
        <div class="room-meta" style="justify-content:center">
          <span class="tag live">● ${players.length || Number(state.room?.participantCount || 1)}명 참가</span>
          ${teamBadgeHtml()}
          <span class="tag">${escapeHtml(selectedUnitLabel())}</span>
          ${questionBundleTag()}
          ${settingTags()}
        </div>
      </article>
      <article class="panel">
        <div class="section-title"><h2>대기실 친구들</h2><span class="tag">${players.length}명</span></div>
        <div class="player-cloud">${playerChips(players)}</div>
        <button class="secondary-button" type="button" data-action="leave-room">방 나가기</button>
      </article>
    </section>`;
}

function teacherLobbyView() {
  const players = roomPlayers();
  return `
    <section class="screen room-shell" aria-labelledby="teacher-lobby-title">
      <article class="panel">
        ${roomHeader("학생을 초대하세요")}
        ${teacherAccountHtml()}
      </article>
      <div class="teacher-grid">
        <article class="panel">
          <p class="eyebrow">JOIN CODE</p>
          <h2 id="teacher-lobby-title">방 번호</h2>
          <p class="room-code" aria-label="방 번호 ${escapeHtml(state.roomCode)}">${escapeHtml(state.roomCode)}</p>
          <div class="section-title"><h3>참가 학생</h3><span class="tag live">${players.length}명 준비</span></div>
          <div class="player-cloud">${playerChips(players)}</div>
          <button class="primary-button" type="button" data-action="start-room" ${state.busy || players.length === 0 ? "disabled" : ""}>${players.length === 0 ? "학생을 기다리는 중" : `${escapeHtml(modeLabel())} 시작`}</button>
        </article>
        <aside class="panel qr-wrap" aria-label="학생 참가 QR 코드">
          <img src="${escapeHtml(roomApi.qrUrl(state.roomCode))}" alt="방 ${escapeHtml(state.roomCode)} 참가 QR 코드" width="220" height="220">
          <p>카메라로 찍으면 방 번호가 자동 입력돼요.</p>
        </aside>
      </div>
    </section>`;
}

function leaderboardHtml(players, { studentView = false } = {}) {
  const all = [...players].sort((a, b) => (Number(a.rank) || 999) - (Number(b.rank) || 999));
  let visible = all;
  if (studentView && all.length > 5) {
    const meIndex = all.findIndex((player) => player?.isSelf || playerId(player) === state.playerId);
    const start = Math.max(0, Math.min(all.length - 5, meIndex - 2));
    visible = all.slice(start, start + 5);
  }
  if (!visible.length) return `<div class="empty-state">순위가 집계되면 여기에 보여요.</div>`;
  return `<ol class="leaderboard">${visible.map((player, index) => {
    const isMe = Boolean(player?.isSelf) || playerId(player) === state.playerId;
    const rank = Number(player.rank) || all.indexOf(player) + 1 || index + 1;
    return `<li class="rank-row ${isMe ? "me" : ""}">
      <span class="rank-number">${rank}</span>
      <span class="rank-name">${escapeHtml(playerName(player))}${isMe ? " (나)" : ""}</span>
      <span class="rank-score">${playerScore(player).toLocaleString()}점</span>
    </li>`;
  }).join("")}</ol>`;
}

function teamLeaderboardHtml(teams = teamLeaderboard(), { studentView = false } = {}) {
  if (!isTeamMode() || !teams.length) return "";
  return `<ol class="leaderboard team-leaderboard" aria-label="팀 순위">${teams.map((team, index) => {
    const rank = Number(team.rank) || index + 1;
    const isMe = Boolean(team.isSelf) || team.teamId === currentTeam()?.teamId;
    const number = Number(team.teamNumber) || index + 1;
    return `<li class="rank-row team-rank-row ${isMe ? "me" : ""}">
      <span class="rank-number">${rank}</span>
      <span class="rank-name"><strong>${number}팀${isMe ? " (우리 팀)" : ""}</strong><small>${Number(team.memberCount) || 0}명 참여</small></span>
      <span class="rank-score">${Number(team.score || 0).toLocaleString()}점</span>
    </li>`;
  }).join("")}</ol>`;
}

function teamSummaryHtml(room = state.room) {
  if (!isTeamMode(room)) return "";
  const team = currentTeam(room);
  if (!team) return `<div class="team-summary pending"><span>팀 배정</span><strong>선생님이 시작하면 공개돼요</strong></div>`;
  return `<div class="team-summary" aria-label="우리 팀 점수와 순위">
    <span class="team-summary-icon" aria-hidden="true">🛡️</span>
    <span><small>우리 팀</small><strong>${Number(team.teamNumber) || "-"}팀</strong></span>
    <span class="team-summary-score"><small>팀 점수</small><strong>${Number(team.score || 0).toLocaleString()}점</strong></span>
    <span class="team-summary-rank"><small>팀 순위</small><strong>${Number(team.rank) || "-"}위</strong></span>
  </div>`;
}

const ESCAPE_SYMBOLS = {
  moon: { icon: "☾", name: "달" },
  star: { icon: "✦", name: "별" },
  sun: { icon: "☀", name: "해" },
};

function escapeState(room = state.room) {
  return room?.self?.escape || currentPlayer(room)?.escape || null;
}

function escapeRetrySeconds(escape = escapeState()) {
  const retryAt = Number(escape?.retryAt || 0);
  if (!retryAt) return 0;
  const retryMs = retryAt < 1_000_000_000_000 ? retryAt * 1000 : retryAt;
  return Math.max(0, Math.ceil((retryMs - Date.now()) / 1000));
}

function escapeRecord(player, room = state.room) {
  if (player?.escape) return player.escape;
  return {
    roomsCleared: player?.escapeRoomsCleared ?? player?.escape_rooms_cleared ?? 0,
    discoveredCount: player?.escapeDiscoveredCount ?? player?.escape_discovered_count ?? 0,
    escapedAt: player?.escapeEscapedAt ?? player?.escape_escaped_at,
  };
}

function escapeTimeLabel(record, room = state.room) {
  const escapedAt = Number(record?.escapedAt || 0);
  const startedAt = Number(room?.startedAt ?? room?.started_at ?? 0);
  if (!escapedAt) return "탐색 중";
  if (startedAt && escapedAt > startedAt) return `${formatTime((escapedAt - startedAt) / 1000)} 탈출`;
  return "탈출 완료";
}

function syncEscapeCode(previousEscape, nextEscape) {
  if (!previousEscape || !nextEscape) return;
  if (Number(previousEscape.roomIndex) !== Number(nextEscape.roomIndex)
    || Number(previousEscape.roomsCleared) !== Number(nextEscape.roomsCleared)
    || (!previousEscape.escapedAt && nextEscape.escapedAt)) {
    state.escapeCode = "";
  }
}

function escapeProgressHtml(players, { team = false } = {}) {
  if (!players.length) return `<div class="empty-state">탐색 기록을 기다리는 중이에요.</div>`;
  return `<ol class="escape-progress-list" aria-label="${team ? "팀" : "참가자"} 탈출 진행">
    ${players.map((entry, index) => {
      const record = escapeRecord(entry);
      const name = team ? `${Number(entry.teamNumber) || index + 1}팀` : playerName(entry);
      const cleared = Math.max(0, Number(record.roomsCleared || 0));
      const clues = Math.max(0, Number(record.discoveredCount || 0));
      const escaped = Boolean(record.escapedAt);
      return `<li class="escape-progress-row ${escaped ? "escaped" : ""}">
        <span class="escape-progress-mark" aria-hidden="true">${escaped ? "↗" : `${cleared + 1}`}</span>
        <span class="escape-progress-name"><strong>${escapeHtml(name)}${entry?.isSelf ? " (나)" : ""}</strong><small>${escaped ? escapeTimeLabel(record) : `${cleared}/3개 방 · 단서 ${clues}/3`}</small></span>
        <span class="escape-progress-state">${escaped ? "탈출" : "탐색"}</span>
      </li>`;
    }).join("")}
  </ol>`;
}

function escapeQuestionHtml(question, me) {
  const progress = getProgress();
  const qId = questionId(question);
  const qKey = questionOccurrenceKey(question, me);
  const options = question?.opts || question?.options || [];
  const answered = state.pendingQuestionKey === qKey || (me?.answeredQuestionIds || []).includes(qId);
  const imageUrl = safeImageUrl(question?.imageUrl || question?.image);
  if (!state.escapeQuestionOpen) {
    return `<section class="escape-question-fold">
      <div><span>문법 문제</span><strong>조사 기회는 정답마다 1개</strong></div>
      <button type="button" class="escape-fold-button" data-action="toggle-escape-question" aria-expanded="false">문제 펼치기</button>
    </section>`;
  }
  return `<section id="escape-question" class="question-console escape-question" aria-labelledby="question-title">
    <div class="question-console-top"><span class="question-kicker">문제 ${progress.current + 1}</span><button type="button" class="escape-fold-button" data-action="toggle-escape-question" aria-expanded="true">문제 접기</button></div>
    ${imageUrl ? `<img class="question-image" src="${imageUrl}" alt="문제 참고 이미지">` : ""}
    <p class="question-kor">${escapeHtml(question?.kor || question?.promptKor || "알맞은 답을 고르세요.")}</p>
    <h1 id="question-title" class="question-eng" tabindex="-1" role="status" aria-live="polite" aria-atomic="true">${escapeHtml(question?.eng || question?.prompt || question?.text || "문제를 불러오는 중이에요.")}</h1>
    <p class="answer-prompt">정답마다 조사 기회 1개를 얻어요.</p>
    <div class="answers" aria-label="답 선택지">${options.map((option, index) => answerButtonHtml(option, answered, qKey, index)).join("")}</div>
    ${pendingAnswerHtml(qKey)}
    ${feedbackHtml(qKey)}
  </section>`;
}

function escapePlayView() {
  const me = currentPlayer() || {};
  const escape = escapeState() || {};
  const question = currentQuestion();
  const hotspots = Array.isArray(escape.hotspots) ? escape.hotspots : [];
  const lockOrder = Array.isArray(escape.lockOrder) ? escape.lockOrder : [];
  const discovered = Math.max(0, Number(escape.discoveredCount || 0));
  const isEscaped = Boolean(escape.escapedAt);
  const retrySeconds = escapeRetrySeconds(escape);
  const canInspect = Number(escape.focus || 0) > 0 && !state.escapeBusy && state.connectionState === "connected";
  const canUnlock = discovered === 3 && !isEscaped && !state.escapeBusy && !retrySeconds && state.connectionState === "connected";
  const teamMode = isTeamMode();
  const roomNumber = Math.min(3, Math.max(1, Number(escape.roomIndex || 0) + 1));
  const sceneAsset = isEscaped
    ? "./assets/night-exit.webp"
    : ["./assets/night-school.webp", "./assets/night-archive.webp", "./assets/night-exit.webp"][Math.min(2, Math.max(0, Number(escape.roomIndex || 0)))];
  return `<section class="screen escape-layout" aria-labelledby="escape-title">
    <article class="escape-console">
      <div class="escape-topline">
        <div><p class="escape-kicker">NIGHT SCHOOL · ROOM ${String(roomNumber).padStart(2, "0")}</p><h1 id="escape-title">${escapeHtml(escape.title || "야간학교")}</h1></div>
        <div class="escape-timer"><span>남은 시간</span><strong id="game-timer">${formatTime(remainingSeconds())}</strong></div>
      </div>
      <p class="escape-story">${escapeHtml(escape.story || "비상등이 켜진 복도 끝에서, 잠긴 문이 조용히 기다립니다.")}</p>
      <div class="escape-meter" aria-label="방 진행 ${Number(escape.roomsCleared || 0)} / 3"><span style="width:${Math.min(100, Math.max(0, Number(escape.roomsCleared || 0)) * 33.34)}%"></span></div>
      <div class="escape-status-strip"><span>조사 기회 <strong>${Math.max(0, Number(escape.focus || 0))}</strong> / 6</span><span>단서 <strong>${discovered}</strong> / 3</span><span>${isEscaped ? (teamMode ? "팀 탈출 완료" : "탈출 완료") : (teamMode ? "우리 팀과 단서 공유 중" : "내 단서로 탈출 중")}</span></div>
      ${isEscaped ? "" : `<ol class="escape-howto" aria-label="탈출 방법"><li><b>1</b> 문제 맞히기</li><li><b>2</b> 조사하기</li><li><b>3</b> 기호 순서대로 암호</li></ol>`}
      ${isEscaped ? `<section class="escape-complete" role="status"><span aria-hidden="true">✦</span><div><strong>야간학교를 탈출했어요</strong><p>${escapeTimeLabel(escape)} · 친구들의 진행을 기다려 주세요.</p></div></section>` : `
      <section class="escape-scene" style="--escape-scene: url('${sceneAsset}')" aria-label="${escapeHtml(escape.title || "현재 방")} 조사 장면">
        <div class="escape-scene-glow" aria-hidden="true"></div>
        <div class="escape-door" aria-hidden="true"><span>LOCK</span><i></i></div>
        <div class="escape-hotspots">${hotspots.map((spot, index) => {
          const known = spot.clue !== undefined && spot.clue !== null;
          const symbol = ESCAPE_SYMBOLS[spot.symbol] || { icon: "?", name: "기호" };
          return `<button class="escape-hotspot ${known ? "found" : ""}" type="button" data-action="escape-inspect" data-hotspot-id="${escapeHtml(spot.id)}" ${(!known && !canInspect) ? "disabled" : ""} aria-label="${escapeHtml(spot.label)} ${known ? "단서 확인" : "조사"}"><span aria-hidden="true">${symbol.icon}</span><strong>${escapeHtml(spot.label || `조사 지점 ${index + 1}`)}</strong><small>${known ? "단서 확인" : "조사하기"}</small></button>`;
        }).join("")}</div>
      </section>
      <div class="escape-scene-help">${canInspect ? "빛이 닿는 곳을 조사해 보세요. 조사하면 기회 1개를 사용해요." : `<span>새 조사 지점은 문제를 맞힌 뒤에 열려요.</span><button type="button" class="escape-study-button" data-action="escape-open-question">문제 풀기</button>`}</div>`}
      <div class="escape-workbench">
        <section class="clue-notebook" aria-labelledby="notebook-title"><div class="notebook-heading"><span aria-hidden="true">▤</span><div><p>CLUE NOTEBOOK</p><h2 id="notebook-title">단서 수첩</h2></div></div>
          <ol class="clue-lines">${hotspots.map((spot, index) => {
            const details = ESCAPE_SYMBOLS[spot.symbol] || { icon: "?", name: "기호" };
            const known = spot.clue !== undefined && spot.clue !== null;
            return `<li class="${known ? "revealed" : ""}"><span class="symbol-token" aria-label="${details.name}">${details.icon}</span><span>${details.name}</span><strong>${known ? escapeHtml(spot.clue) : "?"}</strong></li>`;
          }).join("") || `<li><span>단서를 찾는 중</span></li>`}</ol>
        </section>
        ${isEscaped ? "" : `<section class="escape-lock" aria-labelledby="lock-title"><p>DOOR LOCK</p><h2 id="lock-title">${lockOrder.map((symbol) => ESCAPE_SYMBOLS[symbol]?.icon || "?").join(" ")}</h2><label for="escape-code">세 기호 순서대로 숫자 입력</label><div class="escape-code-row"><input id="escape-code" name="escapeCode" inputmode="numeric" pattern="[0-9]{3}" maxlength="3" autocomplete="off" value="${escapeHtml(state.escapeCode)}" aria-describedby="lock-help"><button type="button" class="escape-unlock" data-action="escape-unlock" data-escape-retry ${canUnlock ? "" : "disabled"}>${retrySeconds ? `${retrySeconds}초 후 다시 시도` : "문 열기"}</button></div><p id="lock-help">${discovered === 3 ? "수첩의 순서를 확인해 문을 열어 보세요." : "세 단서를 모두 찾으면 자물쇠를 열 수 있어요."}</p></section>`}
      </div>
      ${state.feedback?.escapeMessage ? `<div class="feedback ${state.feedback.escapeTone || "correct"}" role="status">${escapeHtml(state.feedback.escapeMessage)}</div>` : ""}
      ${isEscaped ? "" : escapeQuestionHtml(question, me)}
    </article>
    <aside class="escape-sidebar">
      <section class="escape-side-card"><div class="section-title"><h2>${teamMode ? "팀 탈출 진행" : "참가자 진행"}</h2><span class="tag live">LIVE</span></div><p>${teamMode ? "단서·조사 기회·문 진행은 팀과 함께 공유돼요." : "다른 참가자의 단서는 보이지 않아요."}</p>${escapeProgressHtml(teamMode ? sortedEscapeTeams() : sortedEscapePlayers(), { team: teamMode })}</section>
      <section class="escape-side-card"><div class="section-title"><h2>현재 목표</h2><span class="tag">${Number(escape.roomsCleared || 0)}/3개 방</span></div><p>${isEscaped ? "탈출 기록이 저장되었습니다. 다른 참가자의 탈출을 지켜보세요." : "문법 문제로 조사 기회를 모으고, 세 단서를 순서대로 맞추세요."}</p></section>
    </aside>
  </section>`;
}

function studentPlayView() {
  if (roomMode() === "grammar_escape") return escapePlayView();
  const question = currentQuestion();
  const me = currentPlayer() || {};
  const treasureChoices = me?.treasureChoices || me?.treasure_choices || [];
  const progress = getProgress();
  const qId = questionId(question);
  const qKey = questionOccurrenceKey(question, me);
  const options = question?.opts || question?.options || [];
  const answered = state.pendingQuestionKey === qKey || (me?.answeredQuestionIds || []).includes(qId);
  const imageUrl = safeImageUrl(question?.imageUrl || question?.image);
  const maze = roomMode() === "maze_heist" ? me?.maze : null;
  const teamMode = isTeamMode();
  const mainHeadingId = roomMode() === "treasure_heist" && treasureChoices.length ? "treasure-title" : "question-title";
  const rank = teamMode ? Number(currentTeam()?.rank) || "-" : playerRank(me) || "-";
  const questionCount = Number(state.room?.questionCount ?? state.room?.question_count ?? state.roomConfig?.questionCount ?? 0) || "-";
  const questionText = question?.eng || question?.prompt || question?.text || "문제를 불러오는 중이에요.";
  const longQuestionClass = questionText.length > 80 ? " long-question" : "";
  return `
    <section class="screen student-play arena-game" aria-labelledby="${mainHeadingId}">
      <header class="arena-scoreboard" aria-label="내 게임 현황">
        <div class="arena-scoreboard-brand" aria-hidden="true"><strong>문법 아케이드</strong></div>
        <div class="arena-scoreboard-items">
          <div class="arena-score-item arena-player"><span>이름</span><strong>${escapeHtml(playerName(me))}</strong></div>
          <div class="arena-score-item"><span>점수</span><strong>${playerScore(me).toLocaleString()}점</strong></div>
          <div class="arena-score-item"><span>${teamMode ? "우리 팀 순위" : "현재 순위"}</span><strong>${rank}위</strong></div>
          <div class="arena-score-item arena-time"><span>남은 시간</span><strong id="game-timer">${formatTime(remainingSeconds())}</strong></div>
        </div>
      </header>
      <article class="arena-floor">
        ${teamMode ? teamSummaryHtml() : ""}
        ${roomMode() === "treasure_heist" && treasureChoices.length ? treasureChoiceView(treasureChoices) : question ? `
          <div class="question-console arena-question-console">
            <div class="arena-projection">
              <div class="question-console-top">
                <span class="question-kicker">문제 ${progress.current + 1}</span>
                <span class="arena-mode-meta">푼 문제 ${progress.current} · ${questionCount}문항 · ${teamMode ? "팀전" : "개인전"}</span>
              </div>
              ${imageUrl ? `<img class="question-image" src="${imageUrl}" alt="문제 참고 이미지">` : ""}
              <p class="question-kor">${escapeHtml(question.kor || question.promptKor || "알맞은 답을 고르세요.")}</p>
              <h1 id="question-title" class="question-eng${longQuestionClass}" tabindex="-1" role="status" aria-live="polite" aria-atomic="true">${escapeHtml(questionText)}</h1>
            </div>
            <div class="answers arena-answers" data-option-count="${options.length}" aria-label="답 선택지">${options.map((option, index) => answerButtonHtml(option, answered, qKey, index)).join("")}</div>
            <div class="arena-answer-status">${pendingAnswerHtml(qKey)}${feedbackHtml(qKey)}</div>
          </div>
        ` : `
          <div class="arena-projection arena-loading" id="question-title">다음 문제를 준비하고 있어요…</div>
        `}
        ${maze ? mazeView(maze) : ""}
        <details class="arena-ranking">
          <summary>${teamMode ? `우리 팀 ${rank}위` : `현재 ${rank}위`} · 내 주변 순위 보기</summary>
          <div class="arena-ranking-panel">
            ${teamMode ? `<div class="section-title"><h2>팀 순위</h2><span class="tag live">LIVE</span></div>${teamLeaderboardHtml()}<div class="leaderboard-divider" aria-hidden="true"></div>` : ""}
            <div class="section-title"><h2>개인 순위 · 내 주변</h2><span class="tag live">LIVE</span></div>
            <p class="muted">개인 점수만 보여요. 다른 친구의 정답률은 공개하지 않아요.</p>
            ${leaderboardHtml(sortedPlayers(), { studentView: true })}
          </div>
        </details>
      </article>
    </section>`;
}

function mazeView(maze) {
  const visibleTiles = Array.isArray(maze.visibleTiles) ? maze.visibleTiles : [];
  const nearbyPlayers = Array.isArray(maze.nearbyPlayers) ? maze.nearbyPlayers : [];
  const tiles = new Map(visibleTiles.map((tile) => [`${tile.x}:${tile.y}`, tile.kind]));
  const nearby = new Map(nearbyPlayers.map((player) => [`${player.x}:${player.y}`, player]));
  const cells = [];
  for (let y = Number(maze.y) - 1; y <= Number(maze.y) + 1; y += 1) {
    for (let x = Number(maze.x) - 1; x <= Number(maze.x) + 1; x += 1) {
      const key = `${x}:${y}`;
      const kind = tiles.get(key);
      const player = nearby.get(key);
      const self = x === Number(maze.x) && y === Number(maze.y);
      const icons = { wall: "▦", key: "🔑", trap: "⚠", teleport: "✦", shield: "🛡️", spawn: "⌂", floor: "" };
      const label = self ? "내 위치" : player ? `${player.nickname} 위치` : kind ? `${kind} 칸` : "아직 보이지 않는 칸";
      cells.push(`<div class="maze-cell ${kind || "unknown"} ${self ? "self" : ""} ${player ? "rival" : ""}" role="gridcell" aria-label="${escapeHtml(label)}">
        ${self ? `<span class="maze-avatar" aria-hidden="true">●</span>` : player ? `<span class="maze-rival" aria-hidden="true">◆</span>` : `<span aria-hidden="true">${icons[kind] || ""}</span>`}
      </div>`);
    }
  }
  const moveCredits = Math.max(0, Number(maze.moveCredits || 0));
  const disabled = state.mazeBusy || state.connectionState !== "connected" || moveCredits <= 0;
  const directionNames = { up: "위", down: "아래", left: "왼쪽", right: "오른쪽" };
  const directionFor = (x, y) => {
    const dx = Number(x) - Number(maze.x);
    const dy = Number(y) - Number(maze.y);
    if (Math.abs(dx) + Math.abs(dy) !== 1) return "주변";
    return directionNames[dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "down" : "up"];
  };
  const nearbyObjective = visibleTiles.find((tile) => ["key", "teleport", "shield", "trap"].includes(tile.kind));
  const remainingTreasures = Number(maze.remainingTreasures ?? maze.treasuresRemaining);
  const treasureCue = Number.isFinite(remainingTreasures)
    ? `보물 ${Math.max(0, remainingTreasures)}개 남음`
    : "보물은 미궁 어딘가에 숨겨짐";
  const nearbyCue = nearbyPlayers.length
    ? `근처 ${nearbyPlayers.slice(0, 2).map((player) => `${escapeHtml(player.nickname)} · ${directionFor(player.x, player.y)}`).join(", ")}`
    : "근처에 다른 플레이어 없음";
  return `<section class="maze-stage" aria-labelledby="maze-title">
    <div class="maze-heading">
      <div><p class="eyebrow">GRAMMAR MAZE</p><h2 id="maze-title">문법 미궁 쟁탈전</h2></div>
      <span class="maze-credit">이동권 <strong>${moveCredits}</strong></span>
    </div>
    <div class="maze-inventory" aria-label="미궁 보유 아이템">
      <span>✨ 별가루 <strong>${Number(maze.starDust || 0)}</strong></span>
      <span>🔑 열쇠 <strong>${Number(maze.keys || 0)}</strong></span>
      <span>🛡️ 방패 <strong>${maze.shieldActive ? "ON" : "-"}</strong></span>
    </div>
    <div class="maze-cues" aria-label="미궁 탐색 정보">
      <span>🎯 ${treasureCue}</span>
      <span>🧭 ${nearbyObjective ? `${escapeHtml(nearbyObjective.kind)} · ${directionFor(nearbyObjective.x, nearbyObjective.y)}` : "다음 칸을 탐색하세요"}</span>
      <span>👀 ${nearbyCue}</span>
    </div>
    <div class="maze-playfield">
      <div class="maze-board" role="grid" aria-label="내 위치 주변 3 곱하기 3 미궁">${cells.join("")}</div>
      <div class="maze-controls" aria-label="미궁 이동 버튼">
        <button type="button" data-action="maze-move" data-direction="up" aria-label="위로 이동" ${disabled ? "disabled" : ""}>↑</button>
        <button type="button" data-action="maze-move" data-direction="left" aria-label="왼쪽으로 이동" ${disabled ? "disabled" : ""}>←</button>
        <span class="maze-control-center" aria-hidden="true">${state.mazeBusy ? "…" : "✦"}</span>
        <button type="button" data-action="maze-move" data-direction="right" aria-label="오른쪽으로 이동" ${disabled ? "disabled" : ""}>→</button>
        <button type="button" data-action="maze-move" data-direction="down" aria-label="아래로 이동" ${disabled ? "disabled" : ""}>↓</button>
      </div>
    </div>
    <p class="maze-help">문제를 맞혀 이동권을 얻고, 열쇠로 숨은 보물을 여세요. 빠른 정답 뒤 친구와 만나면 별가루를 가져올 수 있어요.</p>
    ${state.feedback?.mazeMessage ? `<div class="feedback ${state.feedback.mazeTone || "correct"}" role="status">${escapeHtml(state.feedback.mazeMessage)}</div>` : ""}
  </section>`;
}

function treasureChoiceView(choices) {
  return `<div class="treasure-stage" aria-labelledby="treasure-title">
    <div class="treasure-stage-copy">
      <p class="eyebrow">VAULT CHOICE</p>
      <h1 id="treasure-title" tabindex="-1">금고 하나를 고르세요</h1>
      <p>서버가 이미 결과를 봉인했어요. 보너스·약탈·나눔·함정 중 하나가 열립니다.</p>
    </div>
    <div class="treasure-grid">${choices.map((choice, index) => `
      <button class="treasure-button" type="button" data-action="treasure-choice" data-choice-id="${escapeHtml(choice.id)}" ${state.treasureBusy ? "disabled" : ""}>
        <img src="./assets/treasure-vault.webp" alt="" width="112" height="112">
        <strong>${escapeHtml(choice.label || `금고 ${index + 1}`)}</strong>
        <span>${escapeHtml(choice.hint || (index === 0 ? "확정 보너스" : index === 1 ? "모두 함께" : "큰 보상 또는 함정"))}</span>
      </button>`).join("")}</div>
    ${state.feedback?.treasureMessage ? `<div class="feedback correct" role="status">${escapeHtml(state.feedback.treasureMessage)}</div>` : ""}
  </div>`;
}

function answerButtonHtml(option, answered, currentKey, index = 0) {
  const value = String(option);
  let classes = "answer-button";
  if (state.chosenAnswer === value && state.pendingQuestionKey === currentKey) classes += " selected";
  if (state.feedback?.occurrenceKey === currentKey && state.feedback.answer === value) classes += " correct";
  if (state.feedback?.occurrenceKey === currentKey && !state.feedback.correct && state.feedback.selectedAnswer === value) classes += " wrong";
  return `<button class="${classes}" type="button" data-action="answer" data-answer="${escapeHtml(value)}" ${answered ? "disabled" : ""}><span class="answer-key" aria-hidden="true">${String.fromCharCode(65 + index)}</span><span>${escapeHtml(value)}</span></button>`;
}

function feedbackHtml(currentKey) {
  if (!state.feedback?.occurrenceKey) return "";
  const previous = state.feedback.occurrenceKey !== currentKey ? "직전 문제: " : "";
  if (state.feedback.correct) {
    return `<div class="feedback correct" role="status">${previous}정답! +${state.feedback.points || 100}점</div>`;
  }
  const answer = state.feedback.answer ? ` 정답은 ${escapeHtml(state.feedback.answer)}예요.` : "";
  return `<div class="feedback wrong" role="status">${previous}아쉬워요.${answer}</div>`;
}

function pendingAnswerHtml(currentKey) {
  if (state.pendingQuestionKey !== currentKey || state.feedback?.occurrenceKey === currentKey) return "";
  return `<p class="answer-pending" role="status" aria-live="polite">채점 중…</p>`;
}

function teacherLiveView() {
  if (roomMode() === "grammar_escape") return teacherEscapeLiveView();
  const players = sortedPlayers();
  const average = players.length ? Math.round(players.reduce((sum, player) => sum + playerAccuracy(player), 0) / players.length) : 0;
  const totalAnswers = players.reduce((sum, player) => sum + playerAnswered(player), 0);
  const averageAnswers = players.length ? (totalAnswers / players.length).toFixed(1) : "0.0";
  const activePlayers = players.filter((player) => playerAnswered(player) > 0).length;
  return `
    <section class="screen game-layout" aria-labelledby="live-title">
      <article class="panel">
        ${roomHeader(`${modeLabel()} 진행 중`)}
        ${teacherAccountHtml()}
        <div class="game-status" style="margin-top:22px">
          <div class="mini-stat"><span>참가</span><strong>${players.length}명</strong></div>
          <div class="mini-stat"><span>반 평균</span><strong>${average}%</strong></div>
          <div class="mini-stat"><span>남은 시간</span><strong id="game-timer">${formatTime(remainingSeconds())}</strong></div>
        </div>
        <div class="section-title"><h2 id="live-title">개인 순위 · 점수</h2><span class="tag live">● LIVE</span></div>
        ${leaderboardHtml(players)}
        ${isTeamMode() ? `<div class="leaderboard-divider"></div><div class="section-title"><h2>팀 순위 · 합산 점수</h2><span class="tag team-badge">🛡️ 팀전</span></div>${teamLeaderboardHtml()}` : ""}
        <button class="danger-button" style="margin-top:18px" type="button" data-action="finish-room" ${state.busy ? "disabled" : ""}>게임 종료</button>
      </article>
      <aside class="panel">
        <h2>진행 상황</h2>
        <p class="muted">학생별 정답률은 선생님 화면에만 표시됩니다.</p>
        <div class="stat-grid">
          <div class="stat-card"><strong>${totalAnswers}</strong><span>총 응답 수</span></div>
          <div class="stat-card"><strong>${averageAnswers}</strong><span>학생당 평균 응답</span></div>
          <div class="stat-card"><strong>${activePlayers}명</strong><span>응답한 학생</span></div>
        </div>
        ${teacherMiniReport(players)}
      </aside>
  </section>`;
}

function teacherEscapeLiveView() {
  const players = sortedEscapePlayers();
  const escaped = players.filter((player) => Boolean(escapeRecord(player).escapedAt)).length;
  const roomProgress = players.length
    ? (players.reduce((sum, player) => sum + Number(escapeRecord(player).roomsCleared || 0), 0) / players.length).toFixed(1)
    : "0.0";
  const teamMode = isTeamMode();
  return `<section class="screen game-layout" aria-labelledby="live-title">
    <article class="panel escape-teacher-panel">
      ${roomHeader("야간학교 탈출 진행 중")}
      ${teacherAccountHtml()}
      <div class="game-status" style="margin-top:22px">
        <div class="mini-stat"><span>탈출</span><strong>${escaped}명</strong></div>
        <div class="mini-stat"><span>${teamMode ? "팀 평균 방" : "평균 방 진행"}</span><strong>${roomProgress}/3</strong></div>
        <div class="mini-stat"><span>남은 시간</span><strong id="game-timer">${formatTime(remainingSeconds())}</strong></div>
      </div>
      <div class="section-title"><h2 id="live-title">${teamMode ? "팀 탈출 진행표" : "학생 탈출 진행표"}</h2><span class="tag live">● LIVE</span></div>
      <p class="muted">점수보다 방 진행과 탈출 시간이 먼저 표시됩니다. 단서 숫자와 조사 기회는 공개되지 않아요.</p>
      ${escapeProgressHtml(teamMode ? sortedEscapeTeams() : players, { team: teamMode })}
      ${teamMode ? `<div class="leaderboard-divider"></div><div class="section-title"><h2>개인 탈출 기록</h2><span class="tag">개별 기록</span></div>${escapeProgressHtml(players)}` : ""}
      <button class="danger-button" style="margin-top:18px" type="button" data-action="finish-room" ${state.busy ? "disabled" : ""}>게임 종료</button>
    </article>
    <aside class="panel">
      <h2>문법 풀이 현황</h2>
      <p class="muted">정답률은 교사 화면에서만 확인할 수 있어요.</p>
      <div class="stat-grid">
        <div class="stat-card"><strong>${players.length}명</strong><span>참가 학생</span></div>
        <div class="stat-card"><strong>${players.filter((player) => playerAnswered(player) > 0).length}명</strong><span>응답한 학생</span></div>
        <div class="stat-card"><strong>${players.reduce((sum, player) => sum + playerAnswered(player), 0)}</strong><span>총 응답 수</span></div>
      </div>
      ${teacherMiniReport(players)}
    </aside>
  </section>`;
}

function teacherMiniReport(players) {
  if (!players.length) return `<div class="empty-state">학생 기록을 기다리는 중이에요.</div>`;
  return `<div class="mini-report-heading">정답률 요약 <span>개인 순위와 별도 지표</span></div><div class="mini-report" aria-label="학생별 정답률 요약">${players.slice(0, 8).map((player) => `
    <div class="mini-report-row">
      <span class="mini-report-name">${escapeHtml(playerName(player))}</span>
      <span class="mini-report-detail">${playerAccuracy(player)}% 정답 · ${playerAnswered(player)}문항</span>
    </div>`).join("")}</div>`;
}

function studentResultView() {
  if (roomMode() === "grammar_escape") return studentEscapeResultView();
  const me = currentPlayer() || state.room?.result || {};
  const rank = playerRank(me) || Number(me.rank) || "-";
  return `
    <section class="screen panel" aria-labelledby="result-title">
      <div class="result-hero">
        <div class="result-rank" aria-label="${rank}위">${rank}위</div>
        <p class="eyebrow">GAME COMPLETE</p>
        <h1 id="result-title">${escapeHtml(playerName(me))}, 수고했어요!</h1>
        <p class="result-score">${playerScore(me).toLocaleString()}<small style="font-size:.38em">점</small></p>
        <p class="lead">이번 기록은 선생님 리포트에도 저장돼요.</p>
      </div>
      <div class="stat-grid">
        <div class="stat-card"><strong>${playerAccuracy(me)}%</strong><span>내 정답률</span></div>
        <div class="stat-card"><strong>${playerCorrect(me)}</strong><span>맞힌 문제</span></div>
        <div class="stat-card"><strong>${playerAverageMs(me) ? `${(playerAverageMs(me) / 1000).toFixed(1)}초` : "-"}</strong><span>평균 응답</span></div>
      </div>
      <div class="button-row">
        <button class="primary-button" type="button" data-action="back-role">다른 방 참가하기</button>
        <a class="button secondary-button" style="display:grid;place-items:center;text-decoration:none" href="${soloGameUrl()}">혼자 연습하기</a>
      </div>
  </section>`;
}

function studentEscapeResultView() {
  const me = currentPlayer() || state.room?.result || {};
  const record = escapeRecord(me);
  const escaped = Boolean(record.escapedAt);
  return `<section class="screen panel escape-result" aria-labelledby="result-title">
    <div class="result-hero">
      <div class="result-rank" aria-label="${escaped ? "탈출" : "탐색 종료"}">${escaped ? "↗" : "☾"}</div>
      <p class="eyebrow">NIGHT SCHOOL RECORD</p>
      <h1 id="result-title">${escaped ? "야간학교 탈출 성공" : "탐색 기록"}</h1>
      <p class="lead">${escaped ? `${escapeTimeLabel(record)}에 마지막 문을 열었어요.` : "시간이 끝났어요. 다음 방에서 다시 단서를 찾아보세요."}</p>
    </div>
    <div class="stat-grid">
      <div class="stat-card"><strong>${Number(record.roomsCleared || 0)}/3</strong><span>연 방</span></div>
      <div class="stat-card"><strong>${Number(record.discoveredCount || 0)}</strong><span>현재 방 단서</span></div>
      <div class="stat-card"><strong>${escaped ? escapeTimeLabel(record).replace(" 탈출", "") : "-"}</strong><span>탈출 시간</span></div>
    </div>
    <div class="escape-learning-metrics"><span>내 문법 기록</span><strong>정답률 ${playerAccuracy(me)}%</strong><strong>맞힌 문제 ${playerCorrect(me)}개</strong></div>
    <div class="button-row"><button class="primary-button" type="button" data-action="back-role">다른 방 참가하기</button><a class="button secondary-button" style="display:grid;place-items:center;text-decoration:none" href="${soloGameUrl()}">혼자 연습하기</a></div>
  </section>`;
}

function reportRows() {
  const source = state.report?.results || state.report?.players || state.report?.leaderboard || sortedPlayers();
  return Array.isArray(source) ? source : [];
}

function teacherReportView() {
  if (roomMode() === "grammar_escape") return teacherEscapeReportView();
  const players = reportRows();
  const teams = state.report?.teamLeaderboard || state.report?.team_leaderboard || state.room?.teamLeaderboard || [];
  const classAccuracy = players.length ? Math.round(players.reduce((sum, player) => sum + playerAccuracy(player), 0) / players.length) : 0;
  const totalCorrect = players.reduce((sum, player) => sum + playerCorrect(player), 0);
  return `
    <section class="screen room-shell" aria-labelledby="report-title">
      <article class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">PRIVATE TEACHER REPORT</p>
            <h1 id="report-title">게임 결과</h1>
            <p class="muted">방 ${escapeHtml(state.roomCode)} · ${escapeHtml(selectedUnitLabel())}</p>
            ${teacherAccountHtml()}
          </div>
          <button class="back-button" type="button" data-action="leave-room">끝내기</button>
        </div>
        <div class="stat-grid">
          <div class="stat-card"><strong>${players.length}명</strong><span>참가 학생</span></div>
          <div class="stat-card"><strong>${classAccuracy}%</strong><span>반 정답률</span></div>
          <div class="stat-card"><strong>${totalCorrect}</strong><span>총 정답 수</span></div>
        </div>
      </article>
      ${isTeamMode() && Array.isArray(teams) && teams.length ? `<article class="panel"><div class="section-title"><h2>팀별 결과</h2><span class="tag team-badge">🛡️ 합산 점수</span></div>${teamLeaderboardHtml(teams)}</article>` : ""}
      <article class="panel">
        <div class="section-title"><h2>개인별 기록</h2><span class="tag">교사 전용 · 정답률 포함</span></div>
        <div class="table-wrap">
          <table class="report-table">
            <thead><tr><th scope="col">순위</th><th scope="col">닉네임</th><th scope="col">점수</th><th scope="col">정답률</th><th scope="col">정답 수</th><th scope="col">응답 수</th><th scope="col">평균 응답</th></tr></thead>
            <tbody>${players.map((player, index) => `<tr>
              <td>${Number(player.rank) || index + 1}위</td>
              <td><strong>${escapeHtml(playerName(player))}</strong></td>
              <td>${playerScore(player).toLocaleString()}점</td>
              <td>${playerAccuracy(player)}%</td>
              <td>${playerCorrect(player)}개</td>
              <td>${playerAnswered(player)}개</td>
              <td>${playerAverageMs(player) ? `${(playerAverageMs(player) / 1000).toFixed(1)}초` : "-"}</td>
            </tr>`).join("") || `<tr><td colspan="7">집계된 학생 기록이 없어요.</td></tr>`}</tbody>
          </table>
        </div>
        <div class="button-row">
          <button class="primary-button" type="button" data-action="new-room">새 게임방 만들기</button>
          <a class="button secondary-button" style="display:grid;place-items:center;text-decoration:none" href="${soloGameUrl()}">혼자 하기 화면</a>
        </div>
      </article>
  </section>`;
}

function teacherEscapeReportView() {
  const players = sortedEscapePlayers(reportRows());
  const teams = sortedEscapeTeams(state.report?.teamLeaderboard || state.report?.team_leaderboard || state.room?.teamLeaderboard || []);
  const escaped = players.filter((player) => Boolean(escapeRecord(player).escapedAt)).length;
  return `<section class="screen room-shell" aria-labelledby="report-title">
    <article class="panel"><div class="panel-header"><div><p class="eyebrow">PRIVATE TEACHER REPORT</p><h1 id="report-title">야간학교 탈출 결과</h1><p class="muted">방 ${escapeHtml(state.roomCode)} · ${escapeHtml(selectedUnitLabel())}</p>${teacherAccountHtml()}</div><button class="back-button" type="button" data-action="leave-room">끝내기</button></div>
      <div class="stat-grid"><div class="stat-card"><strong>${players.length}명</strong><span>참가 학생</span></div><div class="stat-card"><strong>${escaped}명</strong><span>탈출 성공</span></div><div class="stat-card"><strong>${players.length ? Math.round((escaped / players.length) * 100) : 0}%</strong><span>탈출률</span></div></div></article>
    ${isTeamMode() && Array.isArray(teams) && teams.length ? `<article class="panel"><div class="section-title"><h2>팀별 탈출 진행</h2><span class="tag team-badge">🛡️ 공유 진행</span></div>${escapeProgressHtml(teams, { team: true })}</article>` : ""}
    <article class="panel"><div class="section-title"><h2>개인별 탈출 기록</h2><span class="tag">방 진행 · 탈출 시간 우선</span></div><div class="table-wrap"><table class="report-table escape-report-table"><thead><tr><th scope="col">순위</th><th scope="col">닉네임</th><th scope="col">방 진행</th><th scope="col">현재 방 단서</th><th scope="col">탈출 시간</th><th scope="col">정답률</th></tr></thead><tbody>${players.map((player, index) => { const record = escapeRecord(player); return `<tr><td>${Number(player.rank) || index + 1}위</td><td><strong>${escapeHtml(playerName(player))}</strong></td><td>${Number(record.roomsCleared || 0)}/3</td><td>${Number(record.discoveredCount || 0)}/3</td><td>${escapeTimeLabel(record)}</td><td>${playerAccuracy(player)}%</td></tr>`; }).join("") || `<tr><td colspan="6">집계된 학생 기록이 없어요.</td></tr>`}</tbody></table></div><div class="button-row"><button class="primary-button" type="button" data-action="new-room">새 게임방 만들기</button><a class="button secondary-button" style="display:grid;place-items:center;text-decoration:none" href="${soloGameUrl()}">혼자 하기 화면</a></div></article>
  </section>`;
}

function captureFocus() {
  const active = document.activeElement;
  if (!active || !app.contains(active)) return null;
  return {
    id: active.id,
    name: active.getAttribute("name"),
    action: active.dataset?.action,
    answer: active.dataset?.answer,
    hotspotId: active.dataset?.hotspotId,
    start: typeof active.selectionStart === "number" ? active.selectionStart : null,
    end: typeof active.selectionEnd === "number" ? active.selectionEnd : null,
  };
}

function restoreFocus(saved) {
  if (!saved) return false;
  let target = saved.id ? document.getElementById(saved.id) : null;
  if (!target && saved.name) target = app.querySelector(`[name="${CSS.escape(saved.name)}"]`);
  if (!target && saved.action) {
    const answer = saved.answer ? `[data-answer="${CSS.escape(saved.answer)}"]` : "";
    const hotspot = saved.hotspotId ? `[data-hotspot-id="${CSS.escape(saved.hotspotId)}"]` : "";
    target = app.querySelector(`[data-action="${CSS.escape(saved.action)}"]${answer}${hotspot}`);
  }
  if (!target || target.disabled) return false;
  target.focus({ preventScroll: true });
  if (saved.start !== null && typeof target.setSelectionRange === "function") {
    target.setSelectionRange(saved.start, saved.end);
  }
  return true;
}

function render() {
  const savedFocus = captureFocus();
  const previousQuestionKey = state.renderedQuestionKey;
  let html;
  if (!state.role) html = roleChooser();
  else if (state.role === "student" && !state.room) html = studentJoinView();
  else if (state.role === "teacher" && !state.room) html = teacherSetupView();
  else {
    const status = roomStatus();
    if (state.role === "student") {
      html = status === "waiting" ? studentLobbyView() : status === "playing" ? studentPlayView() : studentResultView();
    } else {
      html = status === "waiting" ? teacherLobbyView() : status === "playing" ? teacherLiveView() : teacherReportView();
    }
  }
  app.innerHTML = `${reconnectPanel()}${html}`;
  bindEvents();
  const restored = restoreFocus(savedFocus);
  if (savedFocus?.action === "answer" && !restored) state.needsQuestionFocus = true;
  const nextQuestionKey = questionOccurrenceKey();
  const questionChanged = Boolean(previousQuestionKey && nextQuestionKey && previousQuestionKey !== nextQuestionKey);
  state.renderedQuestionKey = nextQuestionKey || null;
  if (questionChanged && state.needsQuestionFocus) {
    document.querySelector("#question-title")?.focus({ preventScroll: true });
    state.needsQuestionFocus = false;
  }
  if (state.room && roomStatus() === "playing") ensureClock();
  else stopClock();
}

function bindEvents() {
  app.querySelectorAll("[data-action]").forEach((element) => {
    const action = element.dataset.action;
    if (action === "choose-student") element.addEventListener("click", chooseStudent);
    if (action === "choose-teacher") element.addEventListener("click", chooseTeacher);
    if (action === "back-role") element.addEventListener("click", backToRole);
    if (action === "leave-room") element.addEventListener("click", leaveRoom);
    if (action === "start-room") element.addEventListener("click", startRoom);
    if (action === "finish-room") element.addEventListener("click", finishRoom);
    if (action === "answer") element.addEventListener("click", submitAnswer);
    if (action === "treasure-choice") element.addEventListener("click", chooseTreasure);
    if (action === "maze-move") element.addEventListener("click", moveMaze);
    if (action === "escape-inspect") element.addEventListener("click", inspectEscapeHotspot);
    if (action === "escape-unlock") element.addEventListener("click", unlockEscapeDoor);
    if (action === "toggle-escape-question") element.addEventListener("click", toggleEscapeQuestion);
    if (action === "escape-open-question") element.addEventListener("click", openEscapeQuestion);
    if (action === "new-room") element.addEventListener("click", newRoom);
    if (action === "retry-connection") element.addEventListener("click", retryConnection);
    if (action === "teacher-login") element.addEventListener("click", teacherLogin);
    if (action === "teacher-logout") element.addEventListener("click", logoutTeacher);
    if (action === "reopen-teacher") element.addEventListener("click", reopenTeacherRoom);
    if (action === "select-game") element.addEventListener("click", () => {
      state.selectedGameMode = element.dataset.gameMode || "";
      if (state.teacherSetupDraft) {
        state.teacherSetupDraft = { ...state.teacherSetupDraft, mode: state.selectedGameMode };
        sessionStorage.setItem(TEACHER_SETUP_KEY, JSON.stringify(state.teacherSetupDraft));
      }
      state.teacherSetupStep = 2;
      render();
    });
    if (action === "change-game") element.addEventListener("click", () => {
      saveTeacherDraft();
      state.teacherSetupStep = 1;
      render();
    });
  });

  document.querySelector("#join-form")?.addEventListener("submit", joinRoom);
  document.querySelector("#create-form")?.addEventListener("submit", createRoom);
  const codeInput = document.querySelector("#room-code");
  codeInput?.addEventListener("input", () => {
    codeInput.value = sanitizeCode(codeInput.value);
  });
  const escapeCodeInput = document.querySelector("#escape-code");
  escapeCodeInput?.addEventListener("input", () => {
    state.escapeCode = sanitizeCode(escapeCodeInput.value).slice(0, 3);
    escapeCodeInput.value = state.escapeCode;
  });
  escapeCodeInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      unlockEscapeDoor();
    }
  });
  app.querySelectorAll('input[name="grade"]').forEach((input) => input.addEventListener("change", (event) => {
    const grade = event.target.value;
    state.unitSearch = "";
    const search = document.querySelector("#unit-search");
    if (search) search.value = "";
    const board = document.querySelector("#unit-board");
    if (board) board.innerHTML = unitBoardHtml(grade, "", state.unitSearch);
    refreshMissionSummary();
  }));
  document.querySelector("#unit-search")?.addEventListener("input", (event) => {
    state.unitSearch = event.target.value;
    const grade = document.querySelector('input[name="grade"]:checked')?.value || "g1";
    const selected = document.querySelector('input[name="unitKey"]:checked')?.value || "";
    const board = document.querySelector("#unit-board");
    if (board) board.innerHTML = unitBoardHtml(grade, selected, state.unitSearch);
    refreshMissionSummary();
  });
  document.querySelector("#unit-board")?.addEventListener("change", (event) => {
    if (event.target?.matches('input[name="unitKey"]')) refreshMissionSummary();
  });
  app.querySelectorAll('input[name="questionCount"], input[name="durationSeconds"]').forEach((input) => input.addEventListener("change", refreshMissionSummary));
  app.querySelectorAll('input[name="playStyle"]').forEach((input) => input.addEventListener("change", toggleTeamSettings));
  toggleTeamSettings();
  applyTeacherDraft();
  refreshMissionSummary();
}

function toggleTeamSettings() {
  const selected = document.querySelector('input[name="playStyle"]:checked')?.value;
  const teamField = document.querySelector("#team-count-field");
  if (teamField) teamField.hidden = selected !== "team";
}

function refreshMissionSummary() {
  const form = document.querySelector("#create-form");
  const summary = document.querySelector("#mission-summary");
  if (!form) return;
  const data = new FormData(form);
  const grade = String(data.get("grade") || "g1");
  const unitKey = String(data.get("unitKey") || "");
  const questionCount = Number(data.get("questionCount") || 0);
  const durationSeconds = Number(data.get("durationSeconds") || 0);
  const custom = grade === "custom";
  const title = custom ? state.localSet?.title || "내 문제 세트" : "";
  if (summary) summary.innerHTML = missionSummaryHtml({ grade, unitKey, questionCount, durationSeconds, custom, title });
  const sticky = document.querySelector("#setup-summary");
  if (sticky) sticky.textContent = `${custom ? title : unitLabel(grade, unitKey)} · ${questionCount}문항 · ${formatTime(durationSeconds)}`;
}

function moveMaze(eventOrDirection) {
  const direction = typeof eventOrDirection === "string"
    ? eventOrDirection
    : eventOrDirection.currentTarget?.dataset.direction;
  const maze = currentPlayer()?.maze;
  if (!maze || state.mazeBusy || Number(maze.moveCredits || 0) <= 0) return;
  if (!["up", "down", "left", "right"].includes(direction)) return;
  state.mazeBusy = true;
  state.feedback = { ...(state.feedback || {}), mazeMessage: "서버가 이동 경로를 확인하고 있어요…", mazeTone: "correct" };
  render();
  try {
    state.socket?.send({
      type: "maze_move",
      seq: Number(maze.nextMoveSeq || 0),
      direction,
    });
  } catch (error) {
    state.mazeBusy = false;
    setStatus(friendlyError(error), "error");
    render();
  }
}

function handleMazeKeydown(event) {
  if (state.role !== "student" || roomMode() !== "maze_heist" || roomStatus() !== "playing") return;
  if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(event.target?.tagName)) return;
  const direction = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }[event.key];
  if (!direction) return;
  event.preventDefault();
  moveMaze(direction);
}

function chooseTreasure(event) {
  if (state.treasureBusy) return;
  const choiceId = event.currentTarget.dataset.choiceId;
  if (!choiceId) return;
  state.treasureBusy = true;
  setStatus("금고를 여는 중…");
  render();
  try {
    state.socket?.send({ type: "treasure_choice", choiceId });
  } catch (error) {
    state.treasureBusy = false;
    setStatus(friendlyError(error), "error");
    render();
  }
}

function toggleEscapeQuestion() {
  if (!state.escapeQuestionOpen) {
    openEscapeQuestion();
    return;
  }
  state.escapeQuestionOpen = false;
  render();
}

function openEscapeQuestion() {
  if (!state.escapeQuestionOpen) {
    state.escapeQuestionOpen = true;
    render();
  }
  window.setTimeout(() => {
    const question = document.querySelector("#escape-question");
    if (!question) return;
    question.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
    document.querySelector("#question-title")?.focus({ preventScroll: true });
  }, 0);
}

function sendEscapeAction(action, { hotspotId, code } = {}) {
  const escape = escapeState();
  if (!escape || state.escapeBusy || state.connectionState !== "connected" || roomStatus() !== "playing") return;
  const seq = Number(escape.seq);
  if (!Number.isInteger(seq) || seq < 0) {
    setStatus("조사 상태를 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.", "error");
    return;
  }
  if (action === "unlock" && escapeRetrySeconds(escape) > 0) return;
  state.escapeBusy = true;
  state.escapeAction = action;
  state.feedback = null;
  render();
  try {
    state.socket?.send({
      type: "escape_action",
      action,
      seq,
      ...(hotspotId ? { hotspotId } : {}),
      ...(code ? { code } : {}),
    });
  } catch (error) {
    state.escapeBusy = false;
    state.escapeAction = null;
    setStatus(friendlyError(error), "error");
    render();
  }
}

function inspectEscapeHotspot(event) {
  const hotspotId = event.currentTarget.dataset.hotspotId;
  if (hotspotId) sendEscapeAction("inspect", { hotspotId });
}

function unlockEscapeDoor() {
  const code = sanitizeCode(state.escapeCode);
  state.escapeCode = code;
  if (code.length !== 3) {
    setStatus("수첩을 보고 숫자 세 자리를 입력해 주세요.", "error");
    document.querySelector("#escape-code")?.focus();
    return;
  }
  sendEscapeAction("unlock", { code });
}

function chooseStudent() {
  state.role = "student";
  state.view = "join";
  setStatus();
  render();
  window.setTimeout(() => document.querySelector(state.roomCode ? "#nickname" : "#room-code")?.focus(), 0);
}

async function chooseTeacher() {
  state.role = "teacher";
  state.view = "setup";
  setStatus();
  render();
  await loadTeacherSession();
}

function retryConnection() {
  setStatus("서버에 다시 연결하고 있어요…");
  state.socket?.retry();
  render();
}

function teacherLogin() {
  saveTeacherDraft();
  location.assign(roomApi.loginUrl(teacherReturnTo()));
}

async function logoutTeacher() {
  state.busy = true;
  render();
  let confirmed = false;
  try {
    await roomApi.logoutTeacher();
    confirmed = true;
  } catch (error) {
    confirmed = error instanceof ApiError && error.status === 401;
    resetConnection();
    stopClock();
    state.busy = false;
    if (!confirmed) {
      setStatus("서버에서 로그아웃을 확인하지 못했어요. 다시 시도해 주세요.", "error");
      render();
      return;
    }
  }
  resetConnection();
  stopClock();
  state.role = null;
  state.room = null;
  state.report = null;
  state.roomConfig = null;
  state.roomCode = "";
  state.teacherSession = null;
  state.teacherLoginRequired = false;
  state.busy = false;
  updateUrl("");
  setStatus("교사 로그아웃을 완료했어요.", "success");
  render();
}

async function reopenTeacherRoom() {
  state.role = "teacher";
  state.room = null;
  state.busy = true;
  render();
  setStatus(`방 ${state.roomCode} 교사 화면을 확인하고 있어요…`);
  try {
    const session = await loadTeacherSession({ quiet: true });
    if (!session?.authenticated && !isLoopback()) {
      state.busy = false;
      setStatus("교사 로그인이 필요해요.", "error");
      render();
      return;
    }
    const payload = await roomApi.getTeacherRoomState(state.roomCode);
    state.room = applyRoom(payload);
    state.busy = false;
    state.teacherLoginRequired = false;
    connectLiveRoom();
    setStatus("교사 화면을 다시 열었어요.", "success");
    if (roomStatus() === "finished") await loadTeacherReport();
    render();
  } catch (error) {
    state.busy = false;
    if (handleTeacherAuthError(error)) return;
    setStatus(friendlyError(error), "error");
    render();
  }
}

function backToRole() {
  if (state.role === "student") clearStudentCredentials();
  updateUrl("");
  resetToRole();
}

function leaveRoom() {
  if (state.role === "student") clearStudentCredentials();
  updateUrl("");
  resetToRole();
}

function newRoom() {
  resetConnection();
  stopClock();
  state.role = "teacher";
  state.room = null;
  state.report = null;
  state.roomConfig = null;
  state.roomCode = "";
  state.escapeBusy = false;
  state.escapeAction = null;
  state.escapeCode = "";
  state.escapeQuestionOpen = true;
  state.teacherLoginRequired = false;
  state.teacherSetupStep = 1;
  state.selectedGameMode = "";
  state.unitSearch = "";
  updateUrl("");
  setStatus();
  render();
}

async function joinRoom(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const code = sanitizeCode(form.get("roomCode"));
  const nickname = String(form.get("nickname") || "").trim().replace(/\s+/g, " ");
  if (code.length !== 6) {
    setStatus("방 번호 6자리를 확인해 주세요.", "error");
    document.querySelector("#room-code")?.focus();
    return;
  }
  if (!nickname) {
    setStatus("게임에서 사용할 닉네임을 입력해 주세요.", "error");
    document.querySelector("#nickname")?.focus();
    return;
  }

  state.busy = true;
  render();
  setStatus("게임방을 찾고 있어요…");
  try {
    const payload = await roomApi.joinRoom(code, nickname);
    state.roomCode = code;
    state.playerId = payload.playerId;
    state.resumeToken = payload.resumeToken;
    state.room = applyRoom(payload);
    if (!state.playerId || !state.resumeToken || !state.room) throw new ApiError("참가 정보를 받지 못했어요.", 500);
    saveStudentCredentials(state.playerId, state.resumeToken);
    updateUrl(code);
    state.busy = false;
    state.teacherLoginRequired = false;
    if (roomStatus(state.room) === "playing") setStatus();
    else if (roomStatus(state.room) === "finished") setStatus("게임 종료", "success");
    else setStatus("참가 완료! 선생님이 시작할 때까지 기다려 주세요.", "success");
    connectLiveRoom();
    render();
  } catch (error) {
    state.busy = false;
    setStatus(friendlyError(error), "error");
    render();
  }
}

async function createRoom(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const playStyle = String(form.get("playStyle") || "individual");
  const config = {
    grade: String(form.get("grade")),
    unitKey: String(form.get("unitKey")),
    mode: String(form.get("mode") || "score_race"),
    playStyle,
    ...(playStyle === "team" ? { teamCount: Number(form.get("teamCount") || 2) } : {}),
    durationSeconds: Number(form.get("durationSeconds")),
    questionCount: Number(form.get("questionCount")),
    allowLateJoin: form.get("allowLateJoin") === "on",
    shuffleQuestions: form.get("shuffleQuestions") === "on",
    ...(state.localSet ? {
      setTitle: state.localSet.title,
      customQuestions: state.localSet.questions,
    } : {}),
  };
  state.roomConfig = config;
  state.busy = true;
  render();
  setStatus("새 게임방을 만들고 있어요…");
  try {
    const payload = await roomApi.createRoom(config);
    state.roomCode = sanitizeCode(payload.code || payload.state?.code || payload.room?.code);
    state.room = applyRoom(payload);
    if (!state.roomCode || !state.room) throw new ApiError("방 정보를 받지 못했어요.", 500);
    state.busy = false;
    state.teacherLoginRequired = false;
    clearTeacherDraft();
    updateUrl(state.roomCode);
    setStatus("게임방을 만들었어요. 번호나 QR을 학생들에게 보여 주세요.", "success");
    connectLiveRoom();
    render();
  } catch (error) {
    state.busy = false;
    if (handleTeacherAuthError(error)) return;
    setStatus(friendlyError(error), "error");
    render();
  }
}

async function startRoom() {
  state.busy = true;
  render();
  setStatus("게임을 시작하고 있어요…");
  try {
    const payload = await roomApi.startRoom(state.roomCode);
    state.room = applyRoom(payload);
    state.busy = false;
    setStatus(`${modeLabel()} 시작!`, "success");
    render();
  } catch (error) {
    state.busy = false;
    if (handleTeacherAuthError(error)) return;
    setStatus(friendlyError(error), "error");
    render();
  }
}

async function finishRoom() {
  if (!window.confirm("지금 게임을 종료하고 결과를 집계할까요?")) return;
  state.busy = true;
  render();
  try {
    const payload = await roomApi.finishRoom(state.roomCode);
    state.room = applyRoom(payload);
    state.busy = false;
    await loadTeacherReport();
    setStatus("게임 결과를 집계했어요.", "success");
    render();
  } catch (error) {
    state.busy = false;
    if (handleTeacherAuthError(error)) return;
    setStatus(friendlyError(error), "error");
    render();
  }
}

function submitAnswer(event) {
  if (state.pendingQuestionKey || state.busy) return;
  const question = currentQuestion();
  const answer = event.currentTarget.dataset.answer;
  const occurrenceIndex = questionOccurrenceIndex(question);
  const occurrenceKey = questionOccurrenceKey(question);
  if (!questionId(question) || occurrenceIndex === null || !occurrenceKey) {
    setStatus("문제 순서를 확인하지 못했어요. 잠시 뒤 다시 눌러 주세요.", "error");
    return;
  }
  state.chosenAnswer = answer;
  state.pendingQuestionKey = occurrenceKey;
  state.feedback = null;
  state.busy = true;
  render();
  try {
    state.socket?.send({
      type: "answer",
      questionId: questionId(question),
      occurrenceIndex,
      answer,
    });
    state.busy = false;
  } catch (error) {
    state.chosenAnswer = null;
    state.pendingQuestionKey = null;
    state.busy = false;
    setStatus(friendlyError(error), "error");
    render();
  }
}

async function loadTeacherReport() {
  try {
    state.report = await roomApi.getReport(state.roomCode);
    const reportRoom = state.report?.room || {};
    state.roomConfig = {
      grade: reportRoom.grade || state.roomConfig?.grade,
      unitKey: reportRoom.unitKey || reportRoom.unit_key || state.roomConfig?.unitKey,
      durationSeconds: Number(reportRoom.durationSeconds ?? reportRoom.duration_seconds ?? state.roomConfig?.durationSeconds ?? 0),
      questionCount: Number(reportRoom.questionCount ?? reportRoom.question_count ?? state.roomConfig?.questionCount ?? 0),
      allowLateJoin: reportRoom.allowLateJoin ?? reportRoom.allow_late_join ?? state.roomConfig?.allowLateJoin ?? true,
      shuffleQuestions: reportRoom.shuffleQuestions ?? reportRoom.shuffle_questions ?? state.roomConfig?.shuffleQuestions ?? true,
      playStyle: reportRoom.playStyle || reportRoom.play_style || state.roomConfig?.playStyle || "individual",
      teamCount: Number(reportRoom.teamCount ?? reportRoom.team_count ?? state.roomConfig?.teamCount ?? 0),
    };
  } catch (error) {
    if (handleTeacherAuthError(error)) return;
    setStatus(`게임은 종료됐지만 리포트를 불러오지 못했어요. ${friendlyError(error)}`, "error");
  }
}

async function restoreStudentSession() {
  if (state.roomCode.length !== 6) return false;
  const storedId = sessionStorage.getItem(SESSION_PLAYER_ID);
  const storedToken = sessionStorage.getItem(SESSION_RESUME_TOKEN);
  if (!storedId || !storedToken) return false;

  state.role = "student";
  state.playerId = storedId;
  state.resumeToken = storedToken;
  state.view = "lobby";
  render();
  setStatus("게임방에 다시 연결하고 있어요…");
  try {
    const payload = await roomApi.getRoomState(state.roomCode, {
      role: "student",
      playerId: storedId,
      resumeToken: storedToken,
    });
    state.room = applyRoom(payload);
    if (roomStatus(state.room) === "playing") setStatus();
    else if (roomStatus(state.room) === "finished") setStatus("게임 종료", "success");
    else setStatus("게임방에 다시 연결했어요.", "success");
    connectLiveRoom();
    render();
    return true;
  } catch (error) {
    clearStudentCredentials();
    state.role = "student";
    state.room = null;
    setStatus(friendlyError(error), "error");
    render();
    return false;
  }
}

async function restoreTeacherIntent() {
  if (!initialTeacherIntent && !initialAuthError) return false;
  state.role = "teacher";
  state.view = "setup";
  state.teacherAuthLoading = true;
  render();
  const session = await loadTeacherSession({ quiet: true });
  removeAuthQuery();
  if (initialAuthError) setStatus(oauthErrorMessage(initialAuthError), "error");
  else if (session?.authenticated) setStatus("Google 교사 로그인 확인이 완료됐어요.", "success");
  render();
  return true;
}

async function bootstrap() {
  if (await restoreTeacherIntent()) return;
  await restoreStudentSession();
}

window.addEventListener("beforeunload", () => state.socket?.close());
window.addEventListener("keydown", handleMazeKeydown);
render();
bootstrap();
