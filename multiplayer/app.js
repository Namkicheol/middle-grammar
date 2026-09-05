import { ApiError, createRoomSocket, roomApi } from "./api.js";

const SESSION_PLAYER_ID = "mg.multiplayer.playerId";
const SESSION_RESUME_TOKEN = "mg.multiplayer.resumeToken";
const LOCAL_SET_KEY = "mg.multiplayer.localSet";

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

const app = document.querySelector("#app");
const statusRegion = document.querySelector("#status");
const connectionBadge = document.querySelector("#connection-badge");
const initialParams = new URLSearchParams(location.search);

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
  clockTimer: null,
  renderedQuestionKey: null,
  needsQuestionFocus: false,
  localSet: initialParams.get("set") === "local" ? loadLocalSet() : null,
  treasureBusy: false,
  mazeBusy: false,
};

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
  if (!timer) return;
  timer.textContent = formatTime(remainingSeconds());
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
    };
    return byCode[error.code] || error.message;
  }
  return error?.message || "알 수 없는 오류가 생겼어요.";
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
    const room = applyRoom(message);
    if (room && room !== message) state.room = room;
  } else if (type === "room_state" || type === "start") {
    const previousQuestionKey = questionOccurrenceKey();
    state.room = applyRoom(message);
    const nextQuestionKey = questionOccurrenceKey();
    if (type === "start" || (state.pendingQuestionKey && previousQuestionKey !== nextQuestionKey)) {
      state.pendingQuestionKey = null;
      state.chosenAnswer = null;
    }
    if (type === "start") state.feedback = null;
    if (type === "start") setStatus("게임 진행 중", "success");
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
  } else if (type === "finish") {
    state.room = applyRoom(message);
    if (state.room && !state.room.status) state.room.status = "finished";
    stopClock();
    setStatus("게임 종료", "success");
    if (state.role === "teacher") loadTeacherReport();
  } else if (type === "error") {
    const error = new ApiError(message.message || "게임 요청을 처리하지 못했어요.", 0, message.code || message.error);
    setStatus(friendlyError(error), "error");
    if (message.error === "DUPLICATE_ANSWER") {
      state.pendingQuestionKey = null;
      state.chosenAnswer = null;
    }
    state.treasureBusy = false;
    state.mazeBusy = false;
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
  const customSet = state.localSet;
  const customCount = customSet?.questions?.length || 0;
  return `
    <section class="screen panel" aria-labelledby="setup-title">
      <div class="panel-header">
        <div>
          <p class="eyebrow">TEACHER HOST</p>
          <h1 id="setup-title">멀티 게임방 만들기</h1>
          <p class="muted">문제와 게임 방식을 고르세요. 점수·아이템·정답은 서버가 판정해요.</p>
        </div>
        <button class="back-button" type="button" data-action="back-role">뒤로</button>
      </div>
      <form id="create-form" class="form-grid two-column">
        <fieldset class="choice-field full mode-field">
          <legend>게임 방식</legend>
          <div class="mode-grid">
            ${modeCard("score_race", "스피드 점수전", "정답·연속 성공으로 실시간 순위 경쟁", "⚡", true)}
            ${modeCard("treasure_heist", "금고 작전", "정답 뒤 금고를 골라 보너스·약탈·나눔", "./assets/treasure-vault.webp")}
            ${modeCard("maze_heist", "미궁 쟁탈전", "정답으로 이동권을 얻고 열쇠·보물·함정 탐험", "./assets/maze-heist.webp")}
          </div>
        </fieldset>
        ${customSet ? `
          <div class="custom-set-card full">
            <div><span>내 문제 세트</span><strong>${escapeHtml(customSet.title)}</strong><small>${customCount}문항 · 이 브라우저에 임시 저장됨</small></div>
            <a href="./creator.html">문항 수정</a>
          </div>
          <input type="hidden" name="grade" value="custom">
          <input type="hidden" name="unitKey" value="custom-local">
          <input type="hidden" name="questionCount" value="${customCount}">
        ` : `
          <fieldset class="choice-field full grade-field">
            <legend>어느 학년의 미션인가요?</legend>
            <div class="grade-tabs">
              <label class="grade-tab">
                <input type="radio" name="grade" value="g1" checked>
                <span><strong>중학교 1학년</strong><small>기초 문법 탐험</small></span>
              </label>
              <label class="grade-tab">
                <input type="radio" name="grade" value="g2">
                <span><strong>중학교 2학년</strong><small>응용 문법 작전</small></span>
              </label>
            </div>
          </fieldset>
          <fieldset class="choice-field full unit-field">
            <legend>스테이지 선택</legend>
            <div id="unit-board" class="unit-board">${unitBoardHtml("g1")}</div>
          </fieldset>
          <div id="mission-summary" class="mission-summary full" aria-live="polite">${missionSummaryHtml({ grade: "g1", unitKey: UNIT_OPTIONS.g1[0][0], questionCount: 15, durationSeconds: 300 })}</div>
          <a class="build-set-link full" href="./creator.html"><strong>원하는 문제가 없나요?</strong><span>직접 만들거나 Quizlet·Excel/CSV에서 가져오기 →</span></a>
        `}
        <fieldset class="choice-field full">
          <legend>제한 시간</legend>
          <div class="choice-grid time-choices">
            ${choicePill("durationSeconds", "60", "1분")}
            ${choicePill("durationSeconds", "180", "3분")}
            ${choicePill("durationSeconds", "300", "5분", true)}
            ${choicePill("durationSeconds", "420", "7분")}
            ${choicePill("durationSeconds", "600", "10분")}
          </div>
        </fieldset>
        ${customSet ? "" : `<fieldset class="choice-field full">
          <legend>반복 문항 묶음</legend>
          <div class="choice-grid question-choices">
            ${choicePill("questionCount", "10", "10문항")}
            ${choicePill("questionCount", "15", "15문항", true)}
            ${choicePill("questionCount", "20", "20문항")}
          </div>
          <p class="choice-help">제한 시간 동안 모두 풀면 처음부터 계속 나와요.</p>
        </fieldset>`}
        <fieldset class="choice-field full play-style-field">
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
        <fieldset class="toggle-list full">
          <legend>진행 방식</legend>
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
        <button class="primary-button full" type="submit" ${state.busy ? "disabled" : ""}>${state.busy ? "게임방 만드는 중…" : "이 설정으로 게임방 만들기"}</button>
      </form>
      ${state.teacherLoginRequired ? `
        <div class="login-panel" role="alert">
          <strong>교사 로그인이 필요해요.</strong>
          <span>허용된 Google 교사 계정으로 로그인한 뒤 다시 만들 수 있습니다.</span>
          <button class="secondary-button" type="button" data-action="teacher-login">Google 교사 로그인</button>
        </div>` : ""}
      <div class="helper-box">같은 방에서는 닉네임을 중복해서 쓸 수 없어요. 처음 만들 때 Google 교사 로그인이 열릴 수 있습니다.</div>
    </section>`;
}

function modeCard(value, title, description, visual, checked = false) {
  const art = visual.startsWith("./")
    ? `<img src="${visual}" alt="" width="96" height="96">`
    : `<span class="mode-emoji" aria-hidden="true">${visual}</span>`;
  return `<label class="mode-card">
    <input type="radio" name="mode" value="${value}" ${checked ? "checked" : ""} required>
    <span class="mode-card-visual">${art}</span>
    <span class="mode-card-copy"><strong>${title}</strong><small>${description}</small></span>
    <span class="mode-check" aria-hidden="true">✓</span>
  </label>`;
}

function choicePill(name, value, label, checked = false) {
  return `<label class="choice-pill">
    <input type="radio" name="${name}" value="${value}" ${checked ? "checked" : ""} required>
    <span>${label}</span>
  </label>`;
}

function unitBoardHtml(grade, selected = "") {
  const options = UNIT_OPTIONS[grade] || [];
  const selectedKey = selected || options[0]?.[0] || "";
  return options.map(([value, label], index) => {
    const [lesson, ...topicParts] = label.split(" · ");
    const topic = topicParts.join(" · ") || label;
    return `<label class="mission-tile">
      <input type="radio" name="unitKey" value="${escapeHtml(value)}" ${value === selectedKey ? "checked" : ""} required>
      <span class="mission-pin" aria-hidden="true">${escapeHtml(lesson || `L${index + 1}`)}</span>
      <span class="mission-copy"><strong>${escapeHtml(topic)}</strong><small>문법 미션 ${String(index + 1).padStart(2, "0")}</small></span>
      <span class="mission-arrow" aria-hidden="true">↗</span>
    </label>`;
  }).join("");
}

function unitLabel(grade, unitKey) {
  return UNIT_OPTIONS[grade]?.find(([key]) => key === unitKey)?.[1] || "문법 종합";
}

function missionSummaryHtml({ grade = "g1", unitKey = UNIT_OPTIONS.g1[0][0], questionCount = 15, durationSeconds = 300, custom = false, title = "" } = {}) {
  const label = custom ? title || "내 문제 세트" : unitLabel(grade, unitKey);
  const gradeLabel = grade === "g2" ? "중2" : grade === "g1" ? "중1" : "내 문제";
  return `<div class="mission-summary-mark" aria-hidden="true">▶</div>
    <div class="mission-summary-copy"><span>선택한 미션</span><strong>${escapeHtml(label)}</strong></div>
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

function studentPlayView() {
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
  return `
    <section class="screen game-layout" aria-labelledby="${mainHeadingId}">
      <article class="panel">
        <div class="game-status">
          <div class="mini-stat"><span>내 점수</span><strong>${playerScore(me).toLocaleString()}</strong></div>
          <div class="mini-stat"><span>${teamMode ? "우리 팀 순위" : "현재 순위"}</span><strong>${teamMode ? `${Number(currentTeam()?.rank) || "-"}위` : `${playerRank(me) || "-"}위`}</strong></div>
          <div class="mini-stat"><span>남은 시간</span><strong id="game-timer">${formatTime(remainingSeconds())}</strong></div>
        </div>
        ${teamSummaryHtml()}
        <div class="solved-banner" role="status" aria-live="polite"><strong>푼 문제 ${progress.current}</strong><span>시간이 남으면 같은 묶음을 계속 풀어요.</span></div>
        <div class="room-meta compact" aria-label="게임 진행 설정">${teamBadgeHtml()}${questionBundleTag()}${settingTags()}</div>
        ${roomMode() === "treasure_heist" && treasureChoices.length ? treasureChoiceView(treasureChoices) : question ? `
          <div class="question-console">
            <div class="question-console-top"><span class="question-kicker">MISSION ${String(progress.current + 1).padStart(2, "0")}</span><span class="question-type">문법 체크</span></div>
            ${imageUrl ? `<img class="question-image" src="${imageUrl}" alt="문제 참고 이미지">` : ""}
            <p class="question-kor">${escapeHtml(question.kor || question.promptKor || "알맞은 답을 고르세요.")}</p>
            <h1 id="question-title" class="question-eng" tabindex="-1" role="status" aria-live="polite" aria-atomic="true">${escapeHtml(question.eng || question.prompt || question.text || "문제를 불러오는 중이에요.")}</h1>
            <p class="answer-prompt">정답을 골라 다음 미션으로 이동하세요 <span aria-hidden="true">↓</span></p>
            <div class="answers" aria-label="답 선택지">${options.map((option, index) => answerButtonHtml(option, answered, qKey, index)).join("")}</div>
            ${feedbackHtml(qKey)}
          </div>
        ` : `
          <div class="empty-state" id="question-title">다음 문제를 준비하고 있어요…</div>
        `}
        ${maze ? mazeView(maze) : ""}
      </article>
      <aside class="panel">
        ${teamMode ? `<div class="section-title"><h2>팀 순위</h2><span class="tag live">LIVE</span></div>
        <p class="muted">팀 점수는 팀원 모두의 점수를 합산해요.</p>
        ${teamLeaderboardHtml()}
        <div class="leaderboard-divider" aria-hidden="true"></div>` : ""}
        <div class="section-title"><h2>개인 순위 · 내 주변</h2><span class="tag live">LIVE</span></div>
        <p class="muted">개인 점수만 보여요. 다른 친구의 정답률은 공개하지 않아요.</p>
        <div style="height:12px"></div>
        ${leaderboardHtml(sortedPlayers(), { studentView: true })}
      </aside>
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

function teacherLiveView() {
  const players = sortedPlayers();
  const average = players.length ? Math.round(players.reduce((sum, player) => sum + playerAccuracy(player), 0) / players.length) : 0;
  const totalAnswers = players.reduce((sum, player) => sum + playerAnswered(player), 0);
  const averageAnswers = players.length ? (totalAnswers / players.length).toFixed(1) : "0.0";
  const activePlayers = players.filter((player) => playerAnswered(player) > 0).length;
  return `
    <section class="screen game-layout" aria-labelledby="live-title">
      <article class="panel">
        ${roomHeader(`${modeLabel()} 진행 중`)}
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

function teacherMiniReport(players) {
  if (!players.length) return `<div class="empty-state">학생 기록을 기다리는 중이에요.</div>`;
  return `<div class="mini-report-heading">정답률 요약 <span>개인 순위와 별도 지표</span></div><div class="mini-report" aria-label="학생별 정답률 요약">${players.slice(0, 8).map((player) => `
    <div class="mini-report-row">
      <span class="mini-report-name">${escapeHtml(playerName(player))}</span>
      <span class="mini-report-detail">${playerAccuracy(player)}% 정답 · ${playerAnswered(player)}문항</span>
    </div>`).join("")}</div>`;
}

function studentResultView() {
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

function reportRows() {
  const source = state.report?.results || state.report?.players || state.report?.leaderboard || sortedPlayers();
  return Array.isArray(source) ? source : [];
}

function teacherReportView() {
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

function captureFocus() {
  const active = document.activeElement;
  if (!active || !app.contains(active)) return null;
  return {
    id: active.id,
    name: active.getAttribute("name"),
    action: active.dataset?.action,
    answer: active.dataset?.answer,
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
    target = app.querySelector(`[data-action="${CSS.escape(saved.action)}"]${answer}`);
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
    if (action === "new-room") element.addEventListener("click", newRoom);
    if (action === "retry-connection") element.addEventListener("click", retryConnection);
    if (action === "teacher-login") element.addEventListener("click", teacherLogin);
    if (action === "reopen-teacher") element.addEventListener("click", reopenTeacherRoom);
  });

  document.querySelector("#join-form")?.addEventListener("submit", joinRoom);
  document.querySelector("#create-form")?.addEventListener("submit", createRoom);
  const codeInput = document.querySelector("#room-code");
  codeInput?.addEventListener("input", () => {
    codeInput.value = sanitizeCode(codeInput.value);
  });
  app.querySelectorAll('input[name="grade"]').forEach((input) => input.addEventListener("change", (event) => {
    const grade = event.target.value;
    const board = document.querySelector("#unit-board");
    if (board) board.innerHTML = unitBoardHtml(grade);
    refreshMissionSummary();
  }));
  app.querySelectorAll('input[name="unitKey"], input[name="questionCount"], input[name="durationSeconds"]').forEach((input) => input.addEventListener("change", refreshMissionSummary));
  app.querySelectorAll('input[name="playStyle"]').forEach((input) => input.addEventListener("change", toggleTeamSettings));
  toggleTeamSettings();
}

function toggleTeamSettings() {
  const selected = document.querySelector('input[name="playStyle"]:checked')?.value;
  const teamField = document.querySelector("#team-count-field");
  if (teamField) teamField.hidden = selected !== "team";
}

function refreshMissionSummary() {
  const form = document.querySelector("#create-form");
  const summary = document.querySelector("#mission-summary");
  if (!form || !summary) return;
  const data = new FormData(form);
  summary.innerHTML = missionSummaryHtml({
    grade: String(data.get("grade") || "g1"),
    unitKey: String(data.get("unitKey") || ""),
    questionCount: Number(data.get("questionCount") || 0),
    durationSeconds: Number(data.get("durationSeconds") || 0),
  });
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

function chooseStudent() {
  state.role = "student";
  state.view = "join";
  setStatus();
  render();
  window.setTimeout(() => document.querySelector(state.roomCode ? "#nickname" : "#room-code")?.focus(), 0);
}

function chooseTeacher() {
  state.role = "teacher";
  state.view = "setup";
  setStatus();
  render();
}

function retryConnection() {
  setStatus("서버에 다시 연결하고 있어요…");
  state.socket?.retry();
  render();
}

function teacherLogin() {
  const redirectUrl = encodeURIComponent(location.href);
  location.assign(`/cdn-cgi/access/login?redirect_url=${redirectUrl}`);
}

async function reopenTeacherRoom() {
  state.role = "teacher";
  state.room = null;
  state.busy = true;
  render();
  setStatus(`방 ${state.roomCode} 교사 화면을 확인하고 있어요…`);
  try {
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
    if (error instanceof ApiError && error.status === 401) state.teacherLoginRequired = true;
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
  state.teacherLoginRequired = false;
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
    setStatus("참가 완료! 선생님이 시작할 때까지 기다려 주세요.", "success");
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
    updateUrl(state.roomCode);
    setStatus("게임방을 만들었어요. 번호나 QR을 학생들에게 보여 주세요.", "success");
    connectLiveRoom();
    render();
  } catch (error) {
    state.busy = false;
    if (error instanceof ApiError && error.status === 401) state.teacherLoginRequired = true;
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
    if (error instanceof ApiError && error.status === 401) state.teacherLoginRequired = true;
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
    if (error instanceof ApiError && error.status === 401) state.teacherLoginRequired = true;
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
    setStatus("게임방에 다시 연결했어요.", "success");
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

window.addEventListener("beforeunload", () => state.socket?.close());
window.addEventListener("keydown", handleMazeKeydown);
render();
restoreStudentSession();
