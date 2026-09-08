(function installClassroomBridge() {
  const CHANNEL = "mg-classroom-v1";
  const params = new URLSearchParams(location.search);
  const enabled = params.get("classroom") === "1";
  let expectedParentOrigin = "";
  try {
    const candidate = new URL(params.get("parentOrigin") || "");
    const loopback = ["localhost", "127.0.0.1", "::1"].includes(candidate.hostname);
    const production = candidate.protocol === "https:" && candidate.hostname.endsWith(".workers.dev");
    if ((loopback && ["http:", "https:"].includes(candidate.protocol)) || production) expectedParentOrigin = candidate.origin;
  } catch {}

  let active = enabled && Boolean(expectedParentOrigin) && window.parent !== window;
  let config = null;
  let latestQuestion = null;
  let answeredKey = "";
  let answeringKey = "";
  let sequence = 0;
  const pending = new Map();
  const finishCallbacks = new Set();
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });

  function post(message) {
    if (active) window.parent.postMessage({ channel: CHANNEL, ...message }, expectedParentOrigin);
  }

  function request(type, payload = {}) {
    if (!active) return Promise.reject(new Error("CLASSROOM_INACTIVE"));
    const requestId = `${Date.now()}-${++sequence}`;
    return new Promise((resolve, reject) => {
      pending.set(requestId, { resolve, reject });
      post({ type, requestId, ...payload });
    });
  }

  window.addEventListener("message", (event) => {
    if (!active || event.source !== window.parent || event.origin !== expectedParentOrigin) return;
    const message = event.data;
    if (!message || message.channel !== CHANNEL) return;
    if (message.type === "config") {
      config = Object.freeze({ mode: String(message.value?.mode || ""), deadlineAt: Number(message.value?.deadlineAt || 0) });
      resolveReady(config);
    } else if (message.type === "response") {
      const waiter = pending.get(message.requestId);
      if (!waiter) return;
      pending.delete(message.requestId);
      if (message.ok) waiter.resolve(message.value);
      else waiter.reject(new Error(String(message.error || "CLASSROOM_REQUEST_FAILED")));
    } else if (message.type === "finish") {
      active = false;
      for (const waiter of pending.values()) waiter.reject(new Error("CLASSROOM_FINISHED"));
      pending.clear();
      for (const callback of finishCallbacks) callback();
    }
  });

  async function getQuestion() {
    if (latestQuestion && `${latestQuestion.occurrenceIndex}:${latestQuestion.id}` !== answeredKey) return latestQuestion;
    latestQuestion = await request("get-question");
    return latestQuestion;
  }

  async function answer(question, selectedText) {
    const key = `${Number(question?.occurrenceIndex)}:${String(question?.id || "")}`;
    if (!question?.id || !Number.isInteger(Number(question?.occurrenceIndex))) throw new Error("INVALID_QUESTION");
    if (key === answeredKey || key === answeringKey) throw new Error("DUPLICATE_ANSWER");
    if (!active) throw new Error("CLASSROOM_INACTIVE");
    if (remainingMs() <= 0) throw new Error("DEADLINE_PASSED");
    answeringKey = key;
    try {
      const result = await request("answer", { question, answer: selectedText === null ? null : String(selectedText) });
      answeredKey = key;
      latestQuestion = null;
      return result;
    } catch (error) {
      latestQuestion = null;
      throw error;
    } finally {
      answeringKey = "";
    }
  }

  function remainingMs() { return config?.deadlineAt ? Math.max(0, config.deadlineAt - Date.now()) : 0; }
  function onFinish(callback) { finishCallbacks.add(callback); return () => finishCallbacks.delete(callback); }

  window.ClassroomMatch = { enabled: active, ready, getQuestion, answer, isActive: () => active, remainingMs, onFinish };
  if (active) post({ type: "ready" });
  else resolveReady({ enabled: false, mode: "", deadlineAt: 0 });
})();
