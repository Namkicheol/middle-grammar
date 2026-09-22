// Focused local integration check for the space-raiders room.
// Live local HTTP/WebSocket integration; never run against a remote environment.
import assert from "node:assert/strict";

const origin = process.argv[2] || "http://127.0.0.1:8787";
const parsed = new URL(origin);
assert(["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname), "Local dev only");
const teacherHeaders = { "X-Dev-Teacher-Email": "space-qa@local.test" };
const sockets = [];

async function api(path, body, headers = {}) {
  const response = await fetch(origin + "/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json();
  assert(response.ok, `${path}: ${response.status} ${JSON.stringify(payload)}`);
  return payload;
}

async function connect(code, player) {
  const { ticket } = await api(`/rooms/${code}/socket-ticket`, { playerId: player.playerId }, { "X-Resume-Token": player.resumeToken });
  const socket = new WebSocket(origin.replace(/^http/, "ws") + `/api/rooms/${code}/ws?ticket=${encodeURIComponent(ticket)}`);
  sockets.push(socket);
  let pending;
  const client = {
    socket,
    request(payload) {
      assert(!pending, "One pending action per client");
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending = null; reject(new Error("WS response timeout")); }, 5000);
        pending = { resolve, reject, timer };
        socket.send(JSON.stringify(payload));
      });
    },
  };
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WS hello timeout")), 5000);
    socket.addEventListener("error", () => reject(new Error("WS connection error")), { once: true });
    socket.addEventListener("message", ({ data }) => {
      const event = JSON.parse(typeof data === "string" ? data : String(data));
      const type = event.type;
      if (type === "hello") { clearTimeout(timer); resolve(); }
      if (pending && ["answer_result", "space_result", "error"].includes(type)) {
        const request = pending;
        pending = null;
        clearTimeout(request.timer);
        if (type === "error") request.reject(new Error(JSON.stringify(event)));
        else request.resolve(event);
      }
    });
  });
  return client;
}

async function state(code, player) {
  return api(`/rooms/${code}/state?playerId=${encodeURIComponent(player.playerId)}`, undefined, { "X-Resume-Token": player.resumeToken });
}

async function run() {
  const questions = Array.from({ length: 5 }, (_, index) => ({
    prompt: `I ___ ready for launch ${index + 1}.`,
    answer: "am",
    choices: ["am", "is", "are", "be"],
  }));
  const created = await api("/teacher/rooms", {
    mode: "space_raiders",
    durationSeconds: 60,
    questionCount: questions.length,
    shuffleQuestions: false,
    customQuestions: questions,
  }, teacherHeaders);
  const { code } = created;
  const players = [];
  for (let index = 0; index < 30; index += 1) {
    players.push(await api(`/rooms/${code}/join`, { nickname: `우주학생${String(index + 1).padStart(2, "0")}` }));
  }
  await api(`/teacher/rooms/${code}/start`, {}, teacherHeaders);
  const clients = await Promise.all(players.map((player) => connect(code, player)));

  const firstResults = [];
  for (let index = 0; index < players.length; index += 1) {
    const current = await state(code, players[index]);
    const question = current.self.currentQuestion;
    assert(question?.id && Number.isInteger(question.occurrenceIndex), `missing current question for player ${index + 1}`);
    const answer = await clients[index].request({
      type: "answer",
      questionId: question.id,
      occurrenceIndex: question.occurrenceIndex,
      answer: "am",
    });
    assert.equal(answer.type, "answer_result");
    assert.equal(answer.result.correct, true);
    assert(answer.result.score > 0, "correct answer must award points");
    const space = answer.state?.self?.space;
    assert.equal(space?.pendingPlanets?.length, 3, "correct answer must reveal three hidden routes");
    const planet = space.pendingPlanets.find((candidate) => candidate.strategy === "safe");
    assert(planet, "a safe route must be available");
    const revealed = await clients[index].request({ type: "space_action", action: "choose_planet", seq: space.seq, planetId: planet.id });
    assert.equal(revealed.type, "space_result");
    assert(revealed.result.energy >= 0, "space result must contain energy");
    assert.equal(revealed.room.self.space.pendingPlanets.length, 0);
    firstResults.push({ nickname: `우주학생${String(index + 1).padStart(2, "0")}`, score: answer.result.score, energy: revealed.result.energy });
  }

  const teacherState = await api(`/teacher/rooms/${code}/state`, undefined, teacherHeaders);
  assert.equal(teacherState.status, "playing");
  assert.equal(teacherState.leaderboard.length, 30, "teacher must see all 30 students");
  assert.deepEqual(teacherState.leaderboard.map((entry) => entry.rank), Array.from({ length: 30 }, (_, index) => index + 1));
  assert(teacherState.leaderboard.every((entry) => Number.isFinite(entry.spaceEnergy)), "leaderboard must expose space energy");
  assert(firstResults.some((entry) => entry.score > 0));
  assert(firstResults.some((entry) => entry.energy > 0));

  const finishedResponse = await api(`/teacher/rooms/${code}/finish`, {}, teacherHeaders);
  const finished = finishedResponse.state;
  assert.equal(finished.status, "finished");
  assert.equal(finished.leaderboard.length, 30);
  const afterFinish = await api(`/teacher/rooms/${code}/state`, undefined, teacherHeaders);
  assert.equal(afterFinish.status, "finished");
  console.log(JSON.stringify({ pass: true, code, students: 30, pointsAwarded: firstResults.filter((entry) => entry.score > 0).length, ranked: afterFinish.leaderboard.length, finished: afterFinish.status }));
}

try {
  await run();
} finally {
  for (const socket of sockets) socket.close();
}
