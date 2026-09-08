const CHANNEL = "mg-classroom-v1";

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function safeQuestion(question) {
  if (!question) return null;
  const occurrenceIndex = Number(question.occurrenceIndex ?? question.occurrence_index);
  const id = question.id || question.questionId || question.question_id;
  if (!id || !Number.isInteger(occurrenceIndex) || occurrenceIndex < 0) return null;
  const opts = (question.opts || question.options || []).map((value) => String(value)).slice(0, 8);
  return {
    id: String(id),
    occurrenceIndex,
    eng: String(question.eng || question.prompt || question.text || ""),
    kor: String(question.kor || question.promptKor || ""),
    opts,
    ...(question.level ? { level: String(question.level) } : {}),
    ...(question.image || question.imageUrl ? { image: String(question.image || question.imageUrl) } : {}),
  };
}

function localChildOrigin() {
  const url = new URL(location.origin);
  url.port = "8791";
  return url.origin;
}

export function classroomGameUrl(mode) {
  const routes = {
    boss_battle: "/game2/",
    bubble_battle: "/game/?mode=bubble",
    tower_race: "/tower/",
    rangers_siege: "/grammar-rangers/",
    whack_race: "/whack-grammar/",
    sentence_blast: "/sentence-blast/",
  };
  const origin = ["localhost", "127.0.0.1", "::1"].includes(location.hostname)
    ? localChildOrigin()
    : "https://middle-grammar.vercel.app";
  const url = new URL(routes[mode], origin);
  url.searchParams.set("classroom", "1");
  url.searchParams.set("parentOrigin", location.origin);
  return url;
}

export class ClassroomHost {
  constructor({ mount, mode, submitAnswer }) {
    this.mount = mount;
    this.mode = mode;
    this.submitAnswer = submitAnswer;
    this.url = classroomGameUrl(mode);
    this.childOrigin = this.url.origin;
    this.question = null;
    this.questionKey = "";
    this.pending = null;
    this.completedKeys = new Set();
    this.uncertainKeys = new Set();
    this.waitingQuestions = [];
    this.active = true;
    this.onMessage = this.onMessage.bind(this);
    window.addEventListener("message", this.onMessage);
    this.renderShell();
    this.clock = window.setInterval(() => this.updateTimer(), 1000);
  }

  renderShell() {
    this.mount.innerHTML = `<section class="screen classroom-host" aria-label="교실 게임">
      <header class="classroom-hud"><div><small>대회 점수</small><strong data-classroom-score>0점</strong></div><div><small>현재 순위</small><strong data-classroom-rank>-위</strong></div><div><small>남은 시간</small><strong data-classroom-time>0:00</strong></div><button class="game-sound-toggle in-game" type="button" data-game-sound-toggle aria-pressed="false">🔊 소리</button></header>
      <p class="classroom-score-note">게임마다 승리 조건을 확인하고 시작하세요.</p>
      <div class="classroom-frame-wrap"><iframe class="classroom-frame" title="${this.mode}" src="${this.url.href}" allow="autoplay; fullscreen" referrerpolicy="strict-origin"></iframe></div>
      <details class="classroom-ranks"><summary>내 주변 순위</summary><ol data-classroom-ranks></ol></details>
    </section>`;
    this.iframe = this.mount.querySelector(".classroom-frame");
  }

  post(message) {
    if (this.iframe?.contentWindow) this.iframe.contentWindow.postMessage({ channel: CHANNEL, ...message }, this.childOrigin);
  }

  respond(requestId, ok, value) {
    this.post({ type: "response", requestId, ok, ...(ok ? { value } : { error: String(value?.message || value || "요청 실패") }) });
  }

  onMessage(event) {
    if (!this.active || event.source !== this.iframe?.contentWindow || event.origin !== this.childOrigin) return;
    const message = event.data;
    if (!message || message.channel !== CHANNEL) return;
    if (message.type === "ready") {
      this.post({ type: "config", value: this.config || { mode: this.mode, deadlineAt: 0 } });
    } else if (message.type === "get-question") {
      if (this.question) this.respond(message.requestId, true, this.question);
      else this.waitingQuestions.push(message.requestId);
    } else if (message.type === "answer") {
      this.acceptAnswer(message);
    }
  }

  acceptAnswer(message) {
    const q = safeQuestion(message.question);
    const key = q ? `${q.occurrenceIndex}:${q.id}` : "";
    if (!this.active || !q || key !== this.questionKey) return this.respond(message.requestId, false, "STALE_QUESTION");
    if (this.pending) return this.respond(message.requestId, false, "DUPLICATE_ANSWER");
    if (Number(this.config?.deadlineAt) && Date.now() >= Number(this.config.deadlineAt)) return this.respond(message.requestId, false, "DEADLINE_PASSED");
    const answer = message.answer === null ? "" : String(message.answer ?? "");
    this.pending = { requestId: message.requestId, key, question: q, answer, needsReconcile: false };
    try {
      this.submitAnswer(q, answer);
    } catch (error) {
      this.pending = null;
      this.respond(message.requestId, false, error);
    }
  }

  update({ question, deadlineAt, score, rank, leaderboard, connected, lastAnswer }) {
    if (!this.active) return;
    this.config = { mode: this.mode, deadlineAt: Number(deadlineAt) || 0 };
    if (lastAnswer) this.answerResult(lastAnswer);
    const next = safeQuestion(question);
    const nextKey = next ? `${next.occurrenceIndex}:${next.id}` : "";
    if (connected !== false && this.pending?.needsReconcile) {
      if (nextKey === this.pending.key) {
        const pending = this.pending;
        pending.needsReconcile = false;
        try {
          this.submitAnswer(pending.question, pending.answer, { reconcile: true });
        } catch (error) {
          this.pending = null;
          this.uncertainKeys.delete(pending.key);
          this.respond(pending.requestId, false, error);
        }
      } else if (nextKey && nextKey !== this.pending.key) {
        const pending = this.pending;
        this.pending = null;
        this.uncertainKeys.delete(pending.key);
        this.respond(pending.requestId, false, "STALE_QUESTION");
      }
    }
    if (nextKey && nextKey !== this.questionKey && !this.completedKeys.has(nextKey)) {
      this.question = next;
      this.questionKey = nextKey;
      for (const requestId of this.waitingQuestions.splice(0)) this.respond(requestId, true, next);
    } else if (!nextKey || this.completedKeys.has(nextKey) || this.uncertainKeys.has(nextKey)) {
      this.question = null;
    }
    this.mount.querySelector("[data-classroom-score]").textContent = `${Number(score || 0).toLocaleString()}점`;
    this.mount.querySelector("[data-classroom-rank]").textContent = rank ? `${rank}위` : "-위";
    this.updateTimer();
    const ranks = this.mount.querySelector("[data-classroom-ranks]");
    ranks.innerHTML = (leaderboard || []).slice(0, 5).map((entry) => `<li><span>${escapeHtml(entry.name || entry.nickname || "학생")}</span><strong>${Number(entry.score || 0).toLocaleString()}점</strong></li>`).join("");
    if (connected === false) this.connectionChanged(false);
  }

  connectionChanged(connected) {
    if (connected || !this.pending) return;
    this.pending.needsReconcile = true;
    this.uncertainKeys.add(this.pending.key);
    if (this.questionKey === this.pending.key) this.question = null;
  }

  updateTimer() {
    const remaining = Math.max(0, Math.ceil((Number(this.config?.deadlineAt || 0) - Date.now()) / 1000));
    const timer = this.mount.querySelector("[data-classroom-time]");
    if (timer) timer.textContent = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  }

  answerResult(result) {
    const occurrenceIndex = Number(result.occurrenceIndex ?? result.occurrence_index);
    const resultId = result.questionId || result.question_id || (this.pending && this.question?.id) || "";
    const resultKey = Number.isInteger(occurrenceIndex) && resultId ? `${occurrenceIndex}:${resultId}` : "";
    if (resultKey) {
      this.completedKeys.add(resultKey);
      this.uncertainKeys.delete(resultKey);
    }
    if (!this.pending || (resultKey && resultKey !== this.pending.key)) return;
    const pendingKey = this.pending.key;
    const requestId = this.pending.requestId;
    this.pending = null;
    this.completedKeys.add(pendingKey);
    this.uncertainKeys.delete(pendingKey);
    if (this.questionKey === pendingKey) this.question = null;
    this.respond(requestId, true, {
      correct: Boolean(result.correct ?? result.isCorrect),
      correctAnswer: String(result.correctAnswer ?? result.answer ?? ""),
      score: Number(result.score ?? result.totalScore ?? 0),
      scoreGain: Number(result.scoreGain ?? result.points ?? result.scoreDelta ?? 0),
      streak: Number(result.streak ?? 0),
      occurrenceIndex,
    });
  }

  finish() { this.post({ type: "finish" }); }
  destroy() { this.finish(); this.active = false; window.clearInterval(this.clock); window.removeEventListener("message", this.onMessage); this.iframe?.remove(); }
}

export { safeQuestion };
