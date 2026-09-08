// Local transport smoke for rebuilt multiplayer modes. Never point this at production.
import assert from "node:assert/strict";

const ORIGIN = process.argv[2] || "http://127.0.0.1:8787";
const url = new URL(ORIGIN);
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname), "Local Worker only");
const TEACHER = { "X-Dev-Teacher-Email": "rebuilt-modes@local.test" };
const sockets = new Set();
const questions = Array.from({ length: 10 }, (_, index) => ({ prompt: `I ___ ready. (${index + 1})`, answer: "am", choices: ["am", "is", "are", "be"] }));

async function api(path, body, headers = {}) {
  const response = await fetch(`${ORIGIN}/api${path}`, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => ({}));
  assert.ok(response.ok, `${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

class Client {
  constructor(socket) {
    this.socket = socket; this.queue = []; this.waiters = [];
    socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(String(data));
      const index = this.waiters.findIndex((waiter) => waiter.types.includes(message.type));
      if (index >= 0) this.waiters.splice(index, 1)[0].resolve(message); else this.queue.push(message);
    });
  }
  next(types, timeoutMs = 5000) {
    types = Array.isArray(types) ? types : [types];
    const index = this.queue.findIndex((message) => types.includes(message.type));
    if (index >= 0) return Promise.resolve(this.queue.splice(index, 1)[0]);
    return new Promise((resolve, reject) => { const waiter = { types, resolve: (value) => { clearTimeout(timer); resolve(value); } }; const timer = setTimeout(() => { this.waiters = this.waiters.filter((item) => item !== waiter); reject(new Error(`Timed out waiting for ${types.join("/")}`)); }, timeoutMs); this.waiters.push(waiter); });
  }
  async send(payload, resultTypes) { this.socket.send(JSON.stringify(payload)); return this.next(resultTypes); }
  close() { this.socket.close(1000, "local smoke complete"); sockets.delete(this.socket); }
}

async function join(code, nickname) { return api(`/rooms/${code}/join`, { nickname }); }
async function connect(code, player) {
  const { ticket } = await api(`/rooms/${code}/socket-ticket`, { playerId: player.playerId }, { "X-Resume-Token": player.resumeToken });
  const socket = new WebSocket(`${ORIGIN.replace(/^http/, "ws")}/api/rooms/${code}/ws?ticket=${encodeURIComponent(ticket)}`); sockets.add(socket);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  const client = new Client(socket); const hello = await client.next("hello"); client.hello = hello; return client;
}
async function state(code, player) { return api(`/rooms/${code}/state?playerId=${encodeURIComponent(player.playerId)}`, undefined, { "X-Resume-Token": player.resumeToken }); }
async function create(mode, extras = {}) { return api("/teacher/rooms", { mode, durationSeconds: 300, questionCount: 10, shuffleQuestions: false, allowLateJoin: true, customQuestions: questions, playStyle: "individual", ...extras }, TEACHER); }
async function start(code) { await api(`/teacher/rooms/${code}/start`, {}, TEACHER); }
async function finish(code) { await api(`/teacher/rooms/${code}/finish`, {}, TEACHER); }
async function solve(code, player, client) {
  const view = await state(code, player); const question = view.self.currentQuestion;
  assert.ok(question?.id && Number.isInteger(question.occurrenceIndex), "Current question missing");
  const result = await client.send({ type: "answer", questionId: question.id, occurrenceIndex: question.occurrenceIndex, answer: "am" }, ["answer_result", "error"]);
  assert.equal(result.type, "answer_result", `Answer failed: ${JSON.stringify(result)}`); assert.equal(result.result.correct, true); return result;
}
async function chooseVault(code, player, client, strategy) {
  const choice = (await state(code, player)).self.treasureChoices.find((item) => item.strategy === strategy);
  assert.ok(choice, `${strategy} vault choice missing`);
  return client.send({ type: "treasure_choice", choiceId: choice.id }, ["treasure_result", "error"]);
}

async function scoreRaceSmoke() {
  const room = await create("score_race");
  const a = await join(room.code, "속도A"), b = await join(room.code, "속도B");
  const ca = await connect(room.code, a), cb = await connect(room.code, b);
  let ended = false;
  try {
    await start(room.code); await Promise.all([ca.next("start"), cb.next("start")]);
    const qa = (await state(room.code, a)).self.currentQuestion;
    const qb = (await state(room.code, b)).self.currentQuestion;
    const correct = await ca.send({ type: "answer", questionId: qa.id, occurrenceIndex: qa.occurrenceIndex, answer: "am" }, ["answer_result", "error"]);
    const wrong = await cb.send({ type: "answer", questionId: qb.id, occurrenceIndex: qb.occurrenceIndex, answer: "is" }, ["answer_result", "error"]);
    assert.equal(correct.type, "answer_result"); assert.equal(correct.result.correct, true); assert.equal(correct.result.score, 100);
    assert.equal(wrong.type, "answer_result"); assert.equal(wrong.result.correct, false); assert.equal(wrong.result.score, 0);
    const viewA = await state(room.code, a), viewB = await state(room.code, b);
    assert.equal(viewA.self.rank, 1); assert.equal(viewB.self.rank, 2);
    assert.deepEqual(viewA.leaderboard.map((player) => player.score), [100, 0]);
    await finish(room.code); ended = true;
    await Promise.all([ca.next("finish"), cb.next("finish")]);
    assert.equal((await state(room.code, a)).status, "finished");
    console.log("score race: two players, correct/wrong scoring, ranking, finish ok");
  } finally { ca.close(); cb.close(); if (!ended) await finish(room.code); }
}

async function vaultSmoke() {
  const room = await create("treasure_heist", { allowSteal: true, allowScoreSwap: true });
  const a = await join(room.code, "금고A"), b = await join(room.code, "금고B"); const ca = await connect(room.code, a), cb = await connect(room.code, b);
  try {
    await start(room.code); await Promise.all([ca.next("start"), cb.next("start")]);
    await solve(room.code, b, cb);
    const banked = await chooseVault(room.code, b, cb, "bank");
    assert.equal(banked.result.strategy, "bank"); assert.equal((await state(room.code, b)).self.vaultRun.unbanked, 0);
    for (let index = 0; index < 3; index++) { await solve(room.code, a, ca); if (index < 2) await chooseVault(room.code, a, ca, "bank"); }
    let own = await state(room.code, a); let swap = own.self.treasureChoices.find((choice) => choice.strategy === "switch");
    assert.ok(swap, "Score-switch choice was not earned after three correct answers");
    const shielded = await ca.send({ type: "treasure_choice", choiceId: swap.id }, ["treasure_result", "error"]);
    assert.equal(shielded.result.kind, "trap", "First switch should consume the rival shield");
    const beforeDuplicate = await state(room.code, a);
    const duplicate = await ca.send({ type: "treasure_choice", choiceId: swap.id }, ["treasure_result", "error"]);
    assert.equal(duplicate.type, "error"); assert.equal((await state(room.code, a)).self.score, beforeDuplicate.self.score, "Duplicate choice changed score");
    for (let index = 0; index < 3; index++) { await solve(room.code, a, ca); if (index < 2) await chooseVault(room.code, a, ca, "bank"); }
    own = await state(room.code, a); swap = own.self.treasureChoices.find((choice) => choice.strategy === "switch");
    const preA = own.self.score, preB = (await state(room.code, b)).self.score;
    const switched = await ca.send({ type: "treasure_choice", choiceId: swap.id }, ["treasure_result", "error"]);
    assert.equal(switched.result.strategy, "switch");
    assert.equal((await state(room.code, a)).self.score, preB); assert.equal((await state(room.code, b)).self.score, preA);
    const saved = await state(room.code, a); ca.close(); const reconnected = await connect(room.code, a);
    assert.equal(reconnected.hello.state.self.score, saved.self.score, "Vault reconnect lost authoritative score"); reconnected.close();
    console.log("vault: bank, shielded switch, score swap, duplicate guard, reconnect ok");
  } finally { ca.close(); cb.close(); await finish(room.code); }
}

async function mazeSmoke() {
  const room = await create("maze_heist"); const a = await join(room.code, "미궁A"), b = await join(room.code, "미궁B"); const ca = await connect(room.code, a), cb = await connect(room.code, b);
  const pathOut = ["down", "down", "right", "right", "down", "down", "left", "left"];
  try {
    await start(room.code); await Promise.all([ca.next("start"), cb.next("start")]);
    let view = await state(room.code, a); assert.deepEqual([view.self.maze.width, view.self.maze.height], [13, 9]); assert.equal(view.self.maze.layout[1][1], "H");
    for (let index = 0; index < 3; index++) await solve(room.code, a, ca);
    for (const direction of pathOut) { const maze = (await state(room.code, a)).self.maze; const moved = await ca.send({ type: "maze_move", seq: maze.nextMoveSeq, direction }, ["maze_move_result", "error"]); assert.equal(moved.type, "maze_move_result", `Maze ${direction} from ${maze.x},${maze.y} failed: ${JSON.stringify(moved)}`); }
    view = await state(room.code, a); assert.equal(view.self.maze.carriedLoot, 12); const staleSeq = view.self.maze.nextMoveSeq - 1;
    const duplicate = await ca.send({ type: "maze_move", seq: staleSeq, direction: "right" }, ["maze_move_result", "error"]); assert.equal(duplicate.type, "error"); assert.equal((await state(room.code, a)).self.maze.carriedLoot, 12);
    for (let index = 0; index < 3; index++) await solve(room.code, a, ca);
    for (const direction of [...pathOut].reverse().map((direction) => ({ right: "left", left: "right", down: "up", up: "down" })[direction])) { const maze = (await state(room.code, a)).self.maze; await ca.send({ type: "maze_move", seq: maze.nextMoveSeq, direction }, ["maze_move_result", "error"]); }
    view = await state(room.code, a); assert.equal(view.self.maze.carriedLoot, 0); assert.equal(view.self.maze.bankedLoot, 12); assert.equal(view.self.score, 12);
    ca.close(); const reconnected = await connect(room.code, a); assert.equal(reconnected.hello.state.self.maze.bankedLoot, 12); reconnected.close();
    console.log("maze: new layout, earned moves, treasure bank, duplicate guard, reconnect ok");
  } finally { ca.close(); cb.close(); await finish(room.code); }
}

async function escapeSmoke() {
  const room = await create("grammar_escape", { playStyle: "team", teamCount: 2 });
  const players = [await join(room.code, "탈출A"), await join(room.code, "탈출B"), await join(room.code, "탈출C")];
  const clients = await Promise.all(players.map((player) => connect(room.code, player)));
  try {
    await start(room.code); await Promise.all(clients.map((client) => client.next("start")));
    const views = await Promise.all(players.map((player) => state(room.code, player))); const mateIndex = views.findIndex((view, index) => index > 0 && view.self.teamId === views[0].self.teamId); assert.ok(mateIndex > 0, "Same-team peer missing");
    for (let roomIndex = 0; roomIndex < 3; roomIndex++) {
      for (let index = 0; index < 3; index++) await solve(room.code, players[0], clients[0]);
      let escape = (await state(room.code, players[0])).self.escape;
      for (const hotspot of escape.hotspots) { const result = await clients[0].send({ type: "escape_action", action: "inspect", seq: escape.seq, hotspotId: hotspot.id }, ["escape_result", "error"]); assert.equal(result.type, "escape_result"); escape = result.room.self.escape; }
      const mate = (await state(room.code, players[mateIndex])).self.escape; assert.equal(mate.discoveredCount, 3, "Team did not receive shared clues");
      const code = escape.lockOrder.map((symbol) => escape.hotspots.find((spot) => spot.symbol === symbol).clue).join("");
      const unlocked = await clients[0].send({ type: "escape_action", action: "unlock", seq: escape.seq, code }, ["escape_result", "error"]); assert.equal(unlocked.type, "escape_result"); assert.equal(unlocked.room.self.escape.roomsCleared, roomIndex + 1);
    }
    const done = await state(room.code, players[0]); assert.ok(done.self.escape.escapedAt); assert.equal(done.self.currentQuestion, undefined);
    const finalAction = await clients[0].send({ type: "escape_action", action: "unlock", seq: done.self.escape.seq, code: "000" }, ["escape_result", "error"]); assert.equal(finalAction.type, "error");
    clients[0].close(); const reconnected = await connect(room.code, players[0]); assert.equal(reconnected.hello.state.self.escape.roomsCleared, 3); reconnected.close();
    console.log("escape: team clues, three apparatus codes, completion guard, reconnect ok");
  } finally { clients.forEach((client) => client.close()); await finish(room.code); }
}

assert.ok(await fetch(`${ORIGIN}/api/auth/session`).catch(() => null), `Local Worker is not running at ${ORIGIN}`);
try { await scoreRaceSmoke(); await vaultSmoke(); await mazeSmoke(); await escapeSmoke(); console.log("PASS: rebuilt multiplayer HTTP/WebSocket integration"); }
finally { for (const socket of sockets) socket.close(1000, "local smoke cleanup"); }
