// Local transport smoke for the mystery treasure choice. Never point this at production.
import assert from "node:assert/strict";

const ORIGIN = process.argv[2] || "http://127.0.0.1:8787";
const originUrl = new URL(ORIGIN);
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(originUrl.hostname), "Local Worker only");

const TEACHER = { "X-Dev-Teacher-Email": "mystery-smoke@local.test" };
const questions = Array.from({ length: 5 }, (_, index) => ({
  prompt: `I ___ ready. (${index + 1})`,
  answer: "am",
  choices: ["am", "is", "are", "be"],
}));
const sockets = new Set();

async function api(path, body, headers = {}) {
  const response = await fetch(`${ORIGIN}/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  assert.ok(response.ok, `${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

class Client {
  constructor(socket) {
    this.socket = socket;
    this.queue = [];
    this.waiters = [];
    socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(String(data));
      const index = this.waiters.findIndex((waiter) => waiter.types.includes(message.type));
      if (index >= 0) this.waiters.splice(index, 1)[0].resolve(message);
      else this.queue.push(message);
    });
  }

  next(types, timeoutMs = 5_000) {
    types = Array.isArray(types) ? types : [types];
    const index = this.queue.findIndex((message) => types.includes(message.type));
    if (index >= 0) return Promise.resolve(this.queue.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = { types, resolve: (value) => { clearTimeout(timer); resolve(value); } };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((item) => item !== waiter);
        reject(new Error(`Timed out waiting for ${types.join("/")}`));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  async send(payload, resultTypes) {
    this.socket.send(JSON.stringify(payload));
    return this.next(resultTypes);
  }

  close() {
    this.socket.close(1000, "mystery smoke complete");
    sockets.delete(this.socket);
  }
}

async function createRoom() {
  return api("/teacher/rooms", {
    mode: "treasure_heist",
    durationSeconds: 300,
    questionCount: questions.length,
    shuffleQuestions: false,
    allowLateJoin: true,
    customQuestions: questions,
    playStyle: "individual",
  }, TEACHER);
}

async function join(code, nickname) {
  return api(`/rooms/${code}/join`, { nickname });
}

async function connect(code, player) {
  const { ticket } = await api(`/rooms/${code}/socket-ticket`, { playerId: player.playerId }, { "X-Resume-Token": player.resumeToken });
  const socket = new WebSocket(`${ORIGIN.replace(/^http/, "ws")}/api/rooms/${code}/ws?ticket=${encodeURIComponent(ticket)}`);
  sockets.add(socket);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const client = new Client(socket);
  await client.next("hello");
  return client;
}

async function roomState(code, player) {
  return api(`/rooms/${code}/state?playerId=${encodeURIComponent(player.playerId)}`, undefined, { "X-Resume-Token": player.resumeToken });
}

async function solve(code, player, client) {
  const view = await roomState(code, player);
  const question = view.self.currentQuestion;
  assert.ok(question?.id && Number.isInteger(question.occurrenceIndex), "Current question missing");
  const result = await client.send({
    type: "answer",
    questionId: question.id,
    occurrenceIndex: question.occurrenceIndex,
    answer: "am",
  }, ["answer_result", "error"]);
  assert.equal(result.type, "answer_result", `Answer failed: ${JSON.stringify(result)}`);
  assert.equal(result.result.correct, true);
}

let room;
let clientA;
let clientB;
try {
  room = await createRoom();
  const playerA = await join(room.code, "미스터리A");
  const playerB = await join(room.code, "미스터리B");
  [clientA, clientB] = await Promise.all([
    connect(room.code, playerA),
    connect(room.code, playerB),
  ]);
  await api(`/teacher/rooms/${room.code}/start`, {}, TEACHER);
  await Promise.all([clientA.next("start"), clientB.next("start")]);

  await solve(room.code, playerA, clientA);
  const before = await roomState(room.code, playerA);
  const mystery = before.self.treasureChoices.find((choice) => choice.strategy === "mystery");
  assert.ok(mystery, "Mystery choice missing");
  assert.deepEqual(Object.keys(mystery).sort(), ["hint", "id", "label", "strategy"]);

  const opened = await clientA.send({ type: "treasure_choice", choiceId: mystery.id }, ["treasure_result", "error"]);
  assert.equal(opened.type, "treasure_result", `Mystery choice failed: ${JSON.stringify(opened)}`);
  assert.equal(opened.result.strategy, "mystery");
  assert.ok(opened.result.event?.id, "Mystery event ID missing");
  assert.ok(Array.isArray(opened.result.event.affectedPlayers), "Mystery snapshots missing");
  assert.equal(opened.result.event.affectedPlayers.length, 2);
  for (const snapshot of opened.result.event.affectedPlayers) {
    assert.equal(typeof snapshot.scoreBefore, "number");
    assert.equal(typeof snapshot.scoreAfter, "number");
    assert.equal(typeof snapshot.unbankedBefore, "number");
    assert.equal(typeof snapshot.unbankedAfter, "number");
  }

  const [viewA, viewB] = await Promise.all([
    roomState(room.code, playerA),
    roomState(room.code, playerB),
  ]);
  assert.deepEqual(viewA.lastTreasureEvent, viewB.lastTreasureEvent, "Peers received different mystery events");
  assert.deepEqual(viewA.lastTreasureEvent, opened.result.event, "State event differs from result event");

  const duplicate = await clientA.send({ type: "treasure_choice", choiceId: mystery.id }, ["treasure_result", "error"]);
  assert.equal(duplicate.type, "error", `Duplicate mystery choice was accepted: ${JSON.stringify(duplicate)}`);
  assert.equal((await roomState(room.code, playerA)).self.score, viewA.self.score, "Duplicate mystery changed score");
  console.log(`PASS: mystery choice, ${opened.result.event.kind} event, peer snapshots, duplicate guard`);
} finally {
  clientA?.close();
  clientB?.close();
  for (const socket of sockets) socket.close(1000, "mystery smoke cleanup");
  if (room) await api(`/teacher/rooms/${room.code}/finish`, {}, TEACHER).catch(() => {});
}
