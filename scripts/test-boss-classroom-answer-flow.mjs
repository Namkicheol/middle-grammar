import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const gameSource = await readFile(new URL("../game2/index.html", import.meta.url), "utf8");
const bridgeSource = await readFile(new URL("../game/classroom-bridge.js", import.meta.url), "utf8");

function functionSource(source, name) {
  const start = source.indexOf(`async function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") { quote = char; continue; }
    if (char === "{") depth += 1;
    if (char === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unterminated ${name}`);
}

// The rendered option has one click path. There is no parallel touch/pointer submission.
assert.match(gameSource, /btn\.onclick = \(\) => handleAnswer\(btn\.textContent, q\.ans, btn\)/);
assert.doesNotMatch(gameSource, /qopt[^\n]*(?:touchstart|pointerdown)|(?:touchstart|pointerdown)[^\n]*handleAnswer/);

const qopts = ["am", "is", "are"].map((textContent) => ({
  textContent,
  disabled: false,
  classList: { add() {} },
}));
const nodes = {
  "qpop-fb": { textContent: "", className: "" },
};
const document = {
  querySelectorAll(selector) { return selector === ".qopt" ? qopts : []; },
  getElementById(id) { return nodes[id] ??= { textContent: "", className: "", classList: { add() {}, remove() {} }, style: {} }; },
};
let GS = {
  phase: 2,
  _qT0: 0,
  _qLimit: 10,
  currentQ: { id: "q1", occurrenceIndex: 0, eng: "We ___ in the library.", kor: "우리는 도서관에 있다.", opts: ["am", "is", "are"] },
  practice: false,
};
let qTimer = 1;
let classroomFinished = false;
let classroomScore = 0;
const calls = [];
let resolveAnswer;
const classroom = {
  answer(question, selected) {
    calls.push({ id: question.id, occurrenceIndex: question.occurrenceIndex, selected });
    return new Promise((resolve) => { resolveAnswer = resolve; });
  },
};
const clicked = { classList: { add() {} } };
const factory = new Function(
  "scope",
  `with(scope){${functionSource(gameSource, "handleAnswer")}\n${functionSource(gameSource, "timeExpired")}\nreturn {handleAnswer,timeExpired};}`,
);
const scope = {
  get GS() { return GS; }, set GS(value) { GS = value; },
  get qTimer() { return qTimer; }, set qTimer(value) { qTimer = value; },
  get classroomFinished() { return classroomFinished; },
  get classroomScore() { return classroomScore; }, set classroomScore(value) { classroomScore = value; },
  document, classroom, classroomOn: () => true, performance: { now: () => 1000 },
  cancelAnimationFrame() {}, wrongLog: [], setTimeout() {}, finishQuestion() {}, practiceFinish() {}, playSfx() {},
};
const game = factory(scope);

const clickPromise = game.handleAnswer("are", undefined, clicked);
await game.timeExpired(undefined); // same animation-frame deadline racing the click
assert.deepEqual(calls, [{ id: "q1", occurrenceIndex: 0, selected: "are" }], "one click must submit once");
resolveAnswer({ correct: true, correctAnswer: "are", score: 100, scoreGain: 100 });
await clickPromise;

GS.phase = 2;
GS.currentQ = { ...GS.currentQ, id: "q2", occurrenceIndex: 1 };
const timeoutPromise = game.timeExpired(undefined);
assert.equal(calls.length, 2, "the following timeout must be the second submission, not a duplicate click");
assert.deepEqual(calls[1], { id: "q2", occurrenceIndex: 1, selected: null });
resolveAnswer({ correct: false, correctAnswer: "is", score: 100, scoreGain: 0 });
await timeoutPromise;

// Independently verify the child bridge suppresses concurrent duplicate submissions.
const posted = [];
let messageHandler;
const parent = { postMessage(message) { posted.push(message); } };
const windowObject = {
  parent,
  addEventListener(type, listener) { if (type === "message") messageHandler = listener; },
};
const context = {
  window: windowObject,
  parent,
  location: { search: "?classroom=1&parentOrigin=http%3A%2F%2F127.0.0.1%3A8787" },
  URL,
  URLSearchParams,
  Date,
  Error,
};
vm.runInNewContext(bridgeSource, context);
messageHandler({ source: parent, origin: "http://127.0.0.1:8787", data: { channel: "mg-classroom-v1", type: "config", value: { mode: "boss_battle", deadlineAt: Date.now() + 60_000 } } });
const question = { id: "q3", occurrenceIndex: 2, eng: "They ___ ready.", kor: "", opts: ["is", "are"] };
const first = windowObject.ClassroomMatch.answer(question, "are");
await assert.rejects(windowObject.ClassroomMatch.answer(question, "are"), /DUPLICATE_ANSWER/);
assert.equal(posted.filter((message) => message.type === "answer").length, 1, "bridge must post one answer for concurrent calls");
const request = posted.findLast((message) => message.type === "answer");
messageHandler({ source: parent, origin: "http://127.0.0.1:8787", data: { channel: "mg-classroom-v1", type: "response", requestId: request.requestId, ok: true, value: { correct: true } } });
await first;

console.log("boss classroom answer flow passed: one correct click + one later timeout = two answers");
