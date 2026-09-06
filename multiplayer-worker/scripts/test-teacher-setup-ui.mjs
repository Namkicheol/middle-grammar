import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appFile = new URL("../../multiplayer/app.js", import.meta.url);
const source = fs.readFileSync(appFile, "utf8");

for (const asset of ["score", "vault", "maze", "escape"]) {
  assert(source.includes(`./assets/cover-${asset}-v2.webp`), `Missing ${asset} game cover`);
}
assert(source.includes("어떤 게임을 할까요?"), "Game picker heading must be visible");
assert(source.includes('data-action="select-game"'), "Each game must select before configuration");
assert(source.includes('data-action="change-game"'), "Configuration must offer changing the game");
assert(source.includes("문제와 시간 설정"), "Configuration step heading must be visible");
assert(source.includes('name="mode" value="${escapeHtml(selectedGame.value)}"'), "Selected game must submit as the room mode");
assert(source.includes('id="unit-search"'), "Unit search must stay available");
assert(source.includes("lesson-group"), "Units must be grouped by lessons");
assert(source.includes("setup-more"), "Advanced settings must remain available in a compact disclosure");
assert(source.includes("allowLateJoin"), "Late joining must remain configurable");
assert(source.includes("shuffleQuestions"), "Question shuffle must remain configurable");
assert(source.includes("state.teacherSetupStep = 2"), "Selecting a game must advance to configuration");
assert(source.includes("state.teacherSetupStep = 1"), "Changing game/new room must return to the picker");
assert(source.includes("state.unitSearch = event.target.value"), "Unit search must update without replacing the whole setup");

const cssFile = new URL("../../multiplayer/styles.css", import.meta.url);
const css = fs.readFileSync(cssFile, "utf8");
assert(css.includes(".game-cover-grid { display: grid; grid-template-columns: repeat(4"), "Desktop needs four game covers");
assert(css.includes("@media (max-width: 1050px) { .game-cover-grid { grid-template-columns: repeat(2"), "Medium widths need two game covers");
assert(css.includes(".teacher-setup-sticky"), "Create summary must remain visible at the bottom");
assert(css.includes("min-height: 44px"), "Teacher setup controls need touch-safe sizing");

const handlers = {};
const actionHandlers = {};
const changeGame = { dataset: { action: "change-game" }, addEventListener(type, handler) { actionHandlers.changeGame = handler; } };
const selectMaze = { dataset: { action: "select-game", gameMode: "maze_heist" }, addEventListener(type, handler) { actionHandlers.selectMaze = handler; } };
const form = {
  values: { grade: "g1", unitKey: "g1-l1-be-verb", mode: "score_race", playStyle: "individual", questionCount: "15", durationSeconds: "300", teamCount: "3", allowLateJoin: "on", shuffleQuestions: "on" },
  elements: { allowLateJoin: { checked: true }, shuffleQuestions: { checked: true } },
  addEventListener() {},
};
const board = { addEventListener(type, handler) { handlers[type] = handler; } };
const sticky = { textContent: "" };
const nodes = new Map([
  ["#app", { querySelectorAll: (selector) => selector === "[data-action]" ? [changeGame, selectMaze] : [] }],
  ["#status", { dataset: {}, textContent: "" }],
  ["#connection-badge", { dataset: {}, textContent: "" }],
  ["#create-form", form],
  ["#unit-board", board],
  ["#setup-summary", sticky],
]);
const sessionValues = new Map();
class TestFormData {
  constructor(target) { this.values = target.values; }
  get(name) { return this.values[name] ?? null; }
  forEach(callback) { Object.entries(this.values).forEach(([key, value]) => callback(value, key)); }
}
const appSource = source
  .replace(/^import .*?;\n/, "")
  .replace(/render\(\);\nbootstrap\(\);\s*$/, "");
const context = vm.createContext({
  document: { querySelector: (selector) => nodes.get(selector) || null, getElementById: () => null, activeElement: null },
  window: { addEventListener() {}, setTimeout, clearTimeout, matchMedia: () => ({ matches: false }) },
  location: { search: "", hostname: "example.test", origin: "https://example.test", href: "https://example.test/multiplayer/" },
  history: { replaceState() {} },
  sessionStorage: { getItem: (key) => sessionValues.get(key) || null, setItem: (key, value) => sessionValues.set(key, value), removeItem: (key) => sessionValues.delete(key) },
  URL,
  URLSearchParams,
  CSS: { escape: (value) => value },
  FormData: TestFormData,
  ApiError: class ApiError extends Error {},
  roomApi: {},
  createRoomSocket: () => null,
});
vm.runInContext(`${appSource}\nrender = () => {}; globalThis.qa = { state, unitBoardHtml, refreshMissionSummary, bindEvents, teacherSetupView };`, context);
const { qa } = context;

const filtered = qa.unitBoardHtml("g1", "g1-l1-be-verb", "to부정사");
assert(filtered.includes('value="g1-l1-be-verb" checked'), "Filtering must preserve the selected unit radio");
assert(filtered.includes('value="g1-l1-be-verb" checked required><span>be동사</span></label>'), "A hidden selected unit must remain a successful form control");
assert(filtered.includes('hidden><h3>L1</h3>'), "Nonmatching lesson groups must be hidden, not removed");
const noResults = qa.unitBoardHtml("g1", "g1-l1-be-verb", "does-not-exist");
assert(noResults.includes('value="g1-l1-be-verb" checked'), "No-result searches must keep the existing selection");
assert(noResults.includes("일치하는 문법 주제가 없어요."), "No-result search feedback must remain visible");

qa.bindEvents();
assert.equal(typeof handlers.change, "function", "Unit board must delegate radio changes from its stable container");
handlers.change({ target: { matches: (selector) => selector === 'input[name="unitKey"]' } });
assert(sticky.textContent.includes("be동사"), "Delegated unit change must refresh the sticky summary");

form.values = { grade: "g2", unitKey: "g2-l4-passive", mode: "score_race", playStyle: "team", teamCount: "4", questionCount: "20", durationSeconds: "420", allowLateJoin: "on", shuffleQuestions: "on" };
form.elements.allowLateJoin.checked = true;
form.elements.shuffleQuestions.checked = true;
actionHandlers.changeGame();
assert.equal(qa.state.teacherSetupStep, 1, "Changing game must return to the picker");
assert.deepEqual(JSON.parse(sessionValues.get("mg.multiplayer.teacherSetup")), { ...form.values, allowLateJoin: true, shuffleQuestions: true, customSet: null }, "Changing game must preserve the complete form draft");
actionHandlers.selectMaze();
assert.equal(qa.state.selectedGameMode, "maze_heist", "New cover selection must set the selected room mode");
assert.equal(JSON.parse(sessionValues.get("mg.multiplayer.teacherSetup")).mode, "maze_heist", "New cover selection must replace the saved room mode");
qa.state.teacherSession = { authenticated: true, configured: true, teacher: { email: "teacher@example.test", role: "teacher" } };
assert(qa.teacherSetupView().includes('name="mode" value="maze_heist"'), "The new cover must become the submitted room mode");

form.values = { grade: "custom", unitKey: "custom-local", questionCount: "7", durationSeconds: "180" };
qa.state.localSet = { title: "우리 반 복습" };
qa.refreshMissionSummary();
assert.equal(sticky.textContent, "우리 반 복습 · 7문항 · 3:00", "Custom sets must also refresh the sticky summary");

console.log("PASS: teacher game picker, compact lesson setup, preserved settings, responsive cover grid, and durable unit selection");
