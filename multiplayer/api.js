const API_ROOT = "/api";
let csrfToken = "";

function isLoopback() {
  return new Set(["localhost", "127.0.0.1", "::1"]).has(window.location.hostname);
}

export class ApiError extends Error {
  constructor(message, status = 0, code = "REQUEST_FAILED") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (isLoopback() && path.startsWith("/teacher")) {
    headers.set("X-Dev-Teacher-Email", "teacher@local.test");
  }

  let response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      credentials: "same-origin",
      ...options,
      headers,
    });
  } catch {
    throw new ApiError("서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.", 0, "NETWORK_ERROR");
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : {};

  if (!response.ok) {
    const message = payload.message || payload.error || friendlyStatus(response.status);
    throw new ApiError(message, response.status, payload.code || payload.error || "REQUEST_FAILED");
  }

  return payload;
}

async function getTeacherSession() {
  const session = await request("/auth/session");
  csrfToken = session?.authenticated && typeof session.csrfToken === "string" ? session.csrfToken : "";
  return session;
}

async function teacherMutation(path, options = {}) {
  const session = await getTeacherSession();
  if (!session?.authenticated && !isLoopback()) {
    throw new ApiError("교사 로그인이 필요해요.", 401, "TEACHER_LOGIN_REQUIRED");
  }
  const headers = new Headers(options.headers || {});
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
  return request(path, { ...options, headers });
}

function loginUrl(returnTo = "/multiplayer/?teacher=1") {
  const requested = new URL(returnTo, window.location.origin);
  const safeReturnTo = requested.origin === window.location.origin
    ? `${requested.pathname}${requested.search}`
    : "/multiplayer/?teacher=1";
  return `${API_ROOT}/auth/google/start?${new URLSearchParams({ returnTo: safeReturnTo })}`;
}

function friendlyStatus(status) {
  if (status === 401) return "교사 로그인이 필요해요.";
  if (status === 404) return "방 번호를 찾지 못했어요.";
  if (status === 409) return "지금은 이 요청을 처리할 수 없어요.";
  if (status >= 500) return "서버가 잠시 바빠요. 잠시 뒤 다시 시도해 주세요.";
  return "요청을 처리하지 못했어요.";
}

export const roomApi = {
  getTeacherSession,

  loginUrl,

  async logoutTeacher() {
    const session = await getTeacherSession();
    if (!session?.authenticated && !isLoopback()) return session;
    const headers = new Headers();
    if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
    try {
      return await request("/auth/logout", { method: "POST", headers });
    } finally {
      csrfToken = "";
    }
  },

  createRoom(config) {
    return teacherMutation("/teacher/rooms", {
      method: "POST",
      body: JSON.stringify(config),
    });
  },

  joinRoom(code, nickname) {
    return request(`/rooms/${encodeURIComponent(code)}/join`, {
      method: "POST",
      body: JSON.stringify({ nickname }),
    });
  },

  getRoomState(code, credentials = {}) {
    const query = new URLSearchParams();
    if (credentials.role) query.set("role", credentials.role);
    if (credentials.playerId) query.set("playerId", credentials.playerId);
    const suffix = query.size ? `?${query}` : "";
    const headers = new Headers();
    if (credentials.resumeToken) headers.set("X-Resume-Token", credentials.resumeToken);
    return request(`/rooms/${encodeURIComponent(code)}/state${suffix}`, { headers });
  },

  createSocketTicket(code, playerId, resumeToken) {
    return request(`/rooms/${encodeURIComponent(code)}/socket-ticket`, {
      method: "POST",
      headers: { "X-Resume-Token": resumeToken },
      body: JSON.stringify({ playerId }),
    });
  },

  getTeacherRoomState(code) {
    return request(`/teacher/rooms/${encodeURIComponent(code)}/state`);
  },

  startRoom(code) {
    return teacherMutation(`/teacher/rooms/${encodeURIComponent(code)}/start`, { method: "POST" });
  },

  finishRoom(code) {
    return teacherMutation(`/teacher/rooms/${encodeURIComponent(code)}/finish`, { method: "POST" });
  },

  getReport(code) {
    return request(`/teacher/reports/${encodeURIComponent(code)}`);
  },

  qrUrl(code) {
    return `${API_ROOT}/rooms/${encodeURIComponent(code)}/qr.svg`;
  },
};

export function createRoomSocket({
  getUrl,
  onMessage,
  onStatus,
  maxReconnects = 8,
}) {
  let socket = null;
  let active = true;
  let reconnects = 0;
  let timer = null;
  let openedOnce = false;

  function status(name, detail = {}) {
    onStatus?.({ name, attempt: reconnects, maxReconnects, ...detail });
  }

  async function connect() {
    if (!active) return;
    status(reconnects ? "reconnecting" : "connecting");

    try {
      const url = await getUrl();
      if (!active) return;
      socket = new WebSocket(url);
    } catch (error) {
      if (
        error instanceof ApiError &&
        ([401, 403, 410].includes(error.status) || error.code === "RECONNECT_EXPIRED")
      ) {
        active = false;
        status("rejected", {
          code: error.code,
          reason: error.status === 410 || error.code === "RECONNECT_EXPIRED"
            ? "재접속 가능한 60초가 지났어요. 선생님께 알려 주세요."
            : error.message,
        });
        return;
      }
      scheduleReconnect();
      return;
    }

    socket.addEventListener("open", () => {
      openedOnce = true;
      reconnects = 0;
      status("connected");
    });

    socket.addEventListener("message", (event) => {
      try {
        onMessage?.(JSON.parse(event.data));
      } catch {
        onMessage?.({ type: "error", message: "서버 메시지를 읽지 못했어요." });
      }
    });

    socket.addEventListener("error", () => {
      status("error");
    });

    socket.addEventListener("close", (event) => {
      socket = null;
      if (!active) {
        status("closed");
        return;
      }
      if (event.code === 1008 || event.code === 4001) {
        active = false;
        status("rejected", { reason: event.reason });
        return;
      }
      scheduleReconnect(openedOnce);
    });
  }

  function scheduleReconnect(wasConnected = false) {
    if (!active || reconnects >= maxReconnects) {
      active = false;
      status("exhausted", { wasConnected });
      return;
    }
    const delays = [500, 1000, 2000, 4000, 8000, 12000, 15000, 18000];
    const delay = delays[Math.min(reconnects, delays.length - 1)];
    reconnects += 1;
    status("reconnecting", { delay });
    timer = window.setTimeout(connect, delay);
  }

  connect();

  return {
    send(message) {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        throw new ApiError("서버와 다시 연결 중이에요. 잠시 뒤 눌러 주세요.", 0, "SOCKET_NOT_READY");
      }
      socket.send(JSON.stringify(message));
    },
    close() {
      active = false;
      if (timer) window.clearTimeout(timer);
      if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, "leaving");
      socket = null;
    },
    retry() {
      if (active && socket) return;
      if (timer) window.clearTimeout(timer);
      active = true;
      reconnects = 0;
      connect();
    },
  };
}
