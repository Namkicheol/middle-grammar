import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const apiFile = new URL("../../multiplayer/api.js", import.meta.url);
const apiSource = fs.readFileSync(apiFile, "utf8")
  .replace("export class ApiError", "class ApiError")
  .replace("export const roomApi", "const roomApi")
  .replace("export function createRoomSocket", "function createRoomSocket");

const requests = [];
const apiContext = vm.createContext({
  URL,
  URLSearchParams,
  Headers,
  Response,
  window: { location: { hostname: "example.test", origin: "https://example.test" } },
  fetch: async (url, options = {}) => {
    requests.push({ url, options });
    if (url === "/api/auth/session") {
      return new Response(JSON.stringify({ authenticated: true, configured: true, csrfToken: "csrf-test" }), {
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ code: "123456" }), { headers: { "content-type": "application/json" } });
  },
});
vm.runInContext(`${apiSource}\nglobalThis.qa = { roomApi };`, apiContext);
await apiContext.qa.roomApi.createRoom({ grade: "g1" });
assert.equal(requests.length, 2, "Teacher mutation must first refresh the session");
assert.equal(requests[1].url, "/api/teacher/rooms");
assert.equal(new Headers(requests[1].options.headers).get("X-CSRF-Token"), "csrf-test");
assert(!apiSource.includes("localStorage"), "Teacher API must not persist tokens in localStorage");

const appFile = new URL("../../multiplayer/app.js", import.meta.url);
const appSource = fs.readFileSync(appFile, "utf8")
  .replace(/^import .*?;\n/, "")
  .replace(/render\(\);\nbootstrap\(\);\s*$/, "");
const elements = new Map();
for (const id of ["app", "status", "connection-badge"]) {
  elements.set(id, { dataset: {}, textContent: "", contains: () => false });
}
const appContext = vm.createContext({
  document: { querySelector: (selector) => elements.get(selector.slice(1)) || null, activeElement: null },
  window: { addEventListener() {}, setTimeout, clearTimeout, matchMedia: () => ({ matches: true }) },
  location: { search: "", hostname: "example.test", origin: "https://example.test", href: "https://example.test/multiplayer/" },
  history: { replaceState() {} },
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  URL,
  URLSearchParams,
  CSS: { escape: (value) => value },
  ApiError: class ApiError extends Error { constructor(message, status = 0) { super(message); this.status = status; } },
  roomApi: { logoutTeacher: async () => { throw new Error("network"); } },
  createRoomSocket: () => null,
});
vm.runInContext(`${appSource}\nrender = () => {}; globalThis.qa = { state, logoutTeacher };`, appContext);
const q = appContext.qa;
let socketClosed = false;
q.state.role = "teacher";
q.state.room = { code: "123456" };
q.state.report = { results: [] };
q.state.teacherSession = { authenticated: true, configured: true, teacher: { email: "teacher@example.test", role: "teacher" } };
q.state.socket = { close() { socketClosed = true; } };
await q.logoutTeacher();
assert.equal(socketClosed, true, "Logout failure must close the active teacher socket");
assert.equal(q.state.role, "teacher", "Logout failure must preserve retryable teacher state");
assert.equal(q.state.room.code, "123456");
assert.equal(elements.get("status").dataset.tone, "error");
assert(!elements.get("status").textContent.includes("완료"), "Logout failure must not claim success");

console.log("PASS: teacher CSRF preflight, no token persistence, and safe logout failure state");
