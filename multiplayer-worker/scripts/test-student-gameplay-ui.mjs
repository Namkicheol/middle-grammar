import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appFile = new URL("../../multiplayer/app.js", import.meta.url);
const cssFile = new URL("../../multiplayer/student-gameplay.css", import.meta.url);
const source = fs.readFileSync(appFile, "utf8")
  .replace(/^import .*?;\n/, "")
  .replace(/render\(\);\nbootstrap\(\);\s*$/, "");

const elements = new Map([
  ["#app", { querySelectorAll: () => [] }],
  ["#status", { dataset: {}, textContent: "" }],
  ["#connection-badge", { dataset: {}, textContent: "" }],
]);
const context = vm.createContext({
  document: { querySelector: (selector) => elements.get(selector) || null, getElementById: () => null, activeElement: null },
  window: { addEventListener() {}, setTimeout, clearTimeout, setInterval: () => 1, clearInterval() {}, matchMedia: () => ({ matches: true }) },
  location: { search: "", hostname: "example.test", origin: "https://example.test", href: "https://example.test/multiplayer/" },
  history: { replaceState() {} },
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  URL,
  URLSearchParams,
  CSS: { escape: (value) => value },
  ApiError: class ApiError extends Error {},
  roomApi: {},
  createRoomSocket: () => null,
});
vm.runInContext(`${source}\nglobalThis.qa = { state, studentPlayView, handleSocketMessage };`, context);

const question = { id: "q1", index: 0, total: 15, kor: "알맞은 답을 고르세요.", eng: "She ___ a book.", opts: ["reads", "read"] };
context.qa.state.playerId = "student-1";
context.qa.state.room = {
  status: "playing",
  mode: "score_race",
  playStyle: "individual",
  questionCount: 15,
  durationSeconds: 300,
  self: { id: "student-1", nickname: "민준", score: 100, rank: 1, answeredCount: 0, currentQuestion: question },
  players: [{ id: "student-1", nickname: "민준", score: 100, rank: 1 }],
};
context.qa.state.pendingQuestionKey = "0:q1";
context.qa.state.feedback = null;
const pending = context.qa.studentPlayView();
assert(pending.includes('class="screen student-play arena-game"'), "Student play must use the arena surface without affecting teacher screens");
assert(pending.includes('class="arena-scoreboard"'), "Student play must render the compact name, score, rank and time HUD");
assert(pending.includes('class="arena-projection"'), "Student question must render on the in-world projection surface");
assert(pending.includes('class="answers arena-answers"'), "Student answers must render in the arena control deck");
assert(pending.includes('class="arena-ranking"'), "Nearby ranking must remain available in a compact disclosure");
assert(!pending.includes('class="mini-stat"'), "Student play must not retain generic metric tiles");
assert(!pending.includes('<aside class="panel">'), "Student play must not keep a permanent leaderboard panel below the game");
assert(pending.includes('class="answer-pending"'), "Pending answers must render an inline grading status");
assert(pending.includes("채점 중…"), "Pending answers must announce grading");
assert(!pending.includes("중간 입장"), "Playing student meta must not include late-join settings");
assert(!pending.includes("문제 순서"), "Playing student meta must not include shuffle settings");
assert(pending.includes("15문항") && pending.includes("개인전"), "Playing student meta must retain compact question count and play style");

context.qa.state.feedback = { occurrenceKey: "0:q1", correct: true, answer: "reads", points: 100 };
const result = context.qa.studentPlayView();
assert(!result.includes("채점 중…"), "Matching server result must replace the pending status");
assert(result.includes("정답! +100점"), "Matching server result must remain visible");

elements.get("#status").textContent = "참가 완료! 선생님이 시작할 때까지 기다려 주세요.";
elements.get("#status").dataset.tone = "success";
context.qa.state.role = "student";
context.qa.handleSocketMessage({ type: "hello", room: context.qa.state.room });
assert.equal(elements.get("#status").textContent, "", "Joining an already-playing room must clear the stale waiting status");
elements.get("#status").textContent = "서버와 연결이 끊겼어요.";
elements.get("#status").dataset.tone = "error";
context.qa.handleSocketMessage({ type: "hello", room: context.qa.state.room });
assert.equal(elements.get("#status").textContent, "서버와 연결이 끊겼어요.", "Playing-room sync must not hide an actionable error");

const css = fs.readFileSync(cssFile, "utf8");
assert(css.includes('url("./assets/arena-v1/gym-background.webp")'), "Arena must use the generated gym background");
assert(css.includes('url("./assets/arena-v1/projection-frame.webp")'), "Arena must use the generated projection frame");
assert(css.includes('url("./assets/arena-v1/answer-panels.webp")'), "Arena must use the generated answer panel sprite");
assert(css.includes("background-size: 400% 100%"), "Answer sprite must be divided into four equal visual panels");
assert(css.includes("background-position: 33.333% center") && css.includes("background-position: 66.667% center"), "Answer sprite positions must address all middle panels");
assert(/@media \(max-width: 700px\)[\s\S]*?\.arena-answers[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/.test(css), "Mobile arena answers must stay in a 2 by 2 grid");

console.log("PASS: arena HUD, projection, sprite answers, compact ranking, mobile grid and pending-to-result feedback");
