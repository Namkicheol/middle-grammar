import { ApiError, createRoomSocket, roomApi } from "./api.js";

const SESSION_PLAYER_ID = "mg.multiplayer.playerId";
const SESSION_RESUME_TOKEN = "mg.multiplayer.resumeToken";

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

const state = {
  view: "role",
  role: null,
  roomCode: sanitizeCode(new URLSearchParams(location.search).get("room") || ""),
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
};

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
  const grade = room?.grade || room?.room?.grade || state.roomConfig?.grade || "g1";
  const unitKey = room?.unitKey || room?.unit_key || room?.unit || room?.room?.unit_key || state.roomConfig?.unitKey || "";
  return UNIT_OPTIONS[grade]?.find(([key]) => key === unitKey)?.[1] || room?.unitLabel || unitKey || "문법 종합";
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
  return `
    <section class="screen panel" aria-labelledby="setup-title">
      <div class="panel-header">
        <div>
          <p class="eyebrow">TEACHER HOST</p>
          <h1 id="setup-title">교실 점수전 만들기</h1>
          <p class="muted">점수와 정답은 서버가 판정하고, 정답률은 교사 화면에만 보여요.</p>
        </div>
        <button class="back-button" type="button" data-action="back-role">뒤로</button>
      </div>
      <form id="create-form" class="form-grid two-column">
        <div class="field">
          <label for="grade">학년</label>
          <select id="grade" name="grade">
            <option value="g1">중학교 1학년</option>
            <option value="g2">중학교 2학년</option>
          </select>
        </div>
        <div class="field">
          <label for="unit-key">문법 범위</label>
          <select id="unit-key" name="unitKey">${unitOptionsHtml("g1")}</select>
        </div>
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
        <fieldset class="choice-field full">
          <legend>반복 문항 묶음</legend>
          <div class="choice-grid question-choices">
            ${choicePill("questionCount", "10", "10문항")}
            ${choicePill("questionCount", "15", "15문항", true)}
            ${choicePill("questionCount", "20", "20문항")}
          </div>
          <p class="choice-help">제한 시간 동안 모두 풀면 처음부터 계속 나와요.</p>
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
        <button class="primary-button full" type="submit" ${state.busy ? "disabled" : ""}>${state.busy ? "게임방 만드는 중…" : "게임방 만들기"}</button>
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

function choicePill(name, value, label, checked = false) {
  return `<label class="choice-pill">
    <input type="radio" name="${name}" value="${value}" ${checked ? "checked" : ""} required>
    <span>${label}</span>
  </label>`;
}

function unitOptionsHtml(grade) {
  return (UNIT_OPTIONS[grade] || []).map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join("");
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
      <span class="tag">${escapeHtml(room.grade === "g2" ? "중2" : "중1")}</span>
      <span class="tag">${escapeHtml(selectedUnitLabel(room))}</span>
      ${questionBundleTag(room)}
      <span class="tag">${formatTime(room.durationSeconds ?? room.duration_seconds ?? 0)}</span>
      ${settingTags(room)}
    </div>`;
}

function settingTags(room = state.room) {
  const lateJoin = room?.allowLateJoin ?? room?.allow_late_join ?? state.roomConfig?.allowLateJoin ?? true;
  const shuffled = room?.shuffleQuestions ?? room?.shuffle_questions ?? state.roomConfig?.shuffleQuestions ?? true;
  return `<span class="tag">중간 입장 ${lateJoin ? "허용" : "마감"}</span>
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
          <button class="primary-button" type="button" data-action="start-room" ${state.busy || players.length === 0 ? "disabled" : ""}>${players.length === 0 ? "학생을 기다리는 중" : "교실 점수전 시작"}</button>
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

function studentPlayView() {
  const question = currentQuestion();
  const me = currentPlayer() || {};
  const progress = getProgress();
  const qId = questionId(question);
  const qKey = questionOccurrenceKey(question, me);
  const options = question?.opts || question?.options || [];
  const answered = state.pendingQuestionKey === qKey || (me?.answeredQuestionIds || []).includes(qId);
  const imageUrl = safeImageUrl(question?.imageUrl || question?.image);
  return `
    <section class="screen game-layout" aria-labelledby="question-title">
      <article class="panel">
        <div class="game-status">
          <div class="mini-stat"><span>내 점수</span><strong>${playerScore(me).toLocaleString()}</strong></div>
          <div class="mini-stat"><span>현재 순위</span><strong>${playerRank(me) || "-"}위</strong></div>
          <div class="mini-stat"><span>남은 시간</span><strong id="game-timer">${formatTime(remainingSeconds())}</strong></div>
        </div>
        <div class="solved-banner" role="status" aria-live="polite"><strong>푼 문제 ${progress.current}</strong><span>시간이 남으면 같은 묶음을 계속 풀어요.</span></div>
        <div class="room-meta compact" aria-label="게임 진행 설정">${questionBundleTag()}${settingTags()}</div>
        ${question ? `
          <p class="eyebrow">오늘의 ${progress.current + 1}번째 문제</p>
          ${imageUrl ? `<img class="question-image" src="${imageUrl}" alt="문제 참고 이미지">` : ""}
          <p class="question-kor">${escapeHtml(question.kor || question.promptKor || "알맞은 답을 고르세요.")}</p>
          <h1 id="question-title" class="question-eng" tabindex="-1" role="status" aria-live="polite" aria-atomic="true">${escapeHtml(question.eng || question.prompt || question.text || "문제를 불러오는 중이에요.")}</h1>
          <div class="answers" aria-label="답 선택지">${options.map((option) => answerButtonHtml(option, answered, qKey)).join("")}</div>
          ${feedbackHtml(qKey)}
        ` : `
          <div class="empty-state" id="question-title">다음 문제를 준비하고 있어요…</div>
        `}
      </article>
      <aside class="panel">
        <div class="section-title"><h2>내 주변 순위</h2><span class="tag live">LIVE</span></div>
        <p class="muted">정답률은 다른 친구에게 보이지 않아요.</p>
        <div style="height:12px"></div>
        ${leaderboardHtml(sortedPlayers(), { studentView: true })}
      </aside>
    </section>`;
}

function answerButtonHtml(option, answered, currentKey) {
  const value = String(option);
  let classes = "answer-button";
  if (state.chosenAnswer === value && state.pendingQuestionKey === currentKey) classes += " selected";
  if (state.feedback?.occurrenceKey === currentKey && state.feedback.answer === value) classes += " correct";
  if (state.feedback?.occurrenceKey === currentKey && !state.feedback.correct && state.feedback.selectedAnswer === value) classes += " wrong";
  return `<button class="${classes}" type="button" data-action="answer" data-answer="${escapeHtml(value)}" ${answered ? "disabled" : ""}>${escapeHtml(value)}</button>`;
}

function feedbackHtml(currentKey) {
  if (!state.feedback) return "";
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
        ${roomHeader("교실 점수전 진행 중")}
        <div class="game-status" style="margin-top:22px">
          <div class="mini-stat"><span>참가</span><strong>${players.length}명</strong></div>
          <div class="mini-stat"><span>반 평균</span><strong>${average}%</strong></div>
          <div class="mini-stat"><span>남은 시간</span><strong id="game-timer">${formatTime(remainingSeconds())}</strong></div>
        </div>
        <div class="section-title"><h2 id="live-title">실시간 순위</h2><span class="tag live">● LIVE</span></div>
        ${leaderboardHtml(players)}
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
  return `<ol class="leaderboard">${players.slice(0, 8).map((player) => `
    <li class="rank-row">
      <span class="rank-number">${playerRank(player)}</span>
      <span class="rank-name">${escapeHtml(playerName(player))}</span>
      <span class="rank-score">${playerAccuracy(player)}%</span>
    </li>`).join("")}</ol>`;
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
        <a class="button secondary-button" style="display:grid;place-items:center;text-decoration:none" href="https://middle-grammar.vercel.app/game/">혼자 연습하기</a>
      </div>
    </section>`;
}

function reportRows() {
  const source = state.report?.results || state.report?.players || state.report?.leaderboard || sortedPlayers();
  return Array.isArray(source) ? source : [];
}

function teacherReportView() {
  const players = reportRows();
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
      <article class="panel">
        <div class="section-title"><h2>개인별 기록</h2><span class="tag">교사 전용</span></div>
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
          <a class="button secondary-button" style="display:grid;place-items:center;text-decoration:none" href="https://middle-grammar.vercel.app/game/">혼자 하기 화면</a>
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
  document.querySelector("#grade")?.addEventListener("change", (event) => {
    const unitSelect = document.querySelector("#unit-key");
    unitSelect.innerHTML = unitOptionsHtml(event.target.value);
  });
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
  const config = {
    grade: String(form.get("grade")),
    unitKey: String(form.get("unitKey")),
    durationSeconds: Number(form.get("durationSeconds")),
    questionCount: Number(form.get("questionCount")),
    allowLateJoin: form.get("allowLateJoin") === "on",
    shuffleQuestions: form.get("shuffleQuestions") === "on",
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
    setStatus("교실 점수전 시작!", "success");
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
render();
restoreStudentSession();
