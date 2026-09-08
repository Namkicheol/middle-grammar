// Local fixture helper for browser QA. Never point this at production.
import assert from "node:assert/strict";

const ORIGIN = process.env.MULTIPLAYER_ORIGIN || "http://127.0.0.1:8787";
const url = new URL(ORIGIN);
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname), "Local Worker only");
const TEACHER = { "X-Dev-Teacher-Email": "rebuilt-ui@local.test" };
const questions = Array.from({ length: 12 }, (_, index) => ({
  prompt: `I ___ ready. (${index + 1})`,
  answer: "am",
  choices: ["am", "is", "are", "be"],
}));

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

async function prepareEscapeRoom3() {
  const room = await api("/teacher/rooms", { mode: "grammar_escape", durationSeconds: 600, questionCount: questions.length, shuffleQuestions: false, allowLateJoin: true, playStyle: "team", teamCount: 2, customQuestions: questions }, TEACHER);
  const player = await api(`/rooms/${room.code}/join`, { nickname: "다이얼검증" });
  const { ticket } = await api(`/rooms/${room.code}/socket-ticket`, { playerId: player.playerId }, { "X-Resume-Token": player.resumeToken });
  const socket = new WebSocket(`${ORIGIN.replace(/^http/, "ws")}/api/rooms/${room.code}/ws?ticket=${encodeURIComponent(ticket)}`);
  const queue = [];
  let wake;
  socket.addEventListener("message", ({ data }) => { queue.push(JSON.parse(String(data))); wake?.(); wake = undefined; });
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  const next = async (types) => {
    for (;;) {
      const index = queue.findIndex((message) => types.includes(message.type));
      if (index >= 0) return queue.splice(index, 1)[0];
      await new Promise((resolve) => { wake = resolve; });
    }
  };
  const send = async (payload, types) => { socket.send(JSON.stringify(payload)); return next(types); };
  const state = () => api(`/rooms/${room.code}/state?playerId=${encodeURIComponent(player.playerId)}`, undefined, { "X-Resume-Token": player.resumeToken });
  const solve = async () => {
    const question = (await state()).self.currentQuestion;
    const result = await send({ type: "answer", questionId: question.id, occurrenceIndex: question.occurrenceIndex, answer: "am" }, ["answer_result", "error"]);
    assert.equal(result.type, "answer_result");
  };
  await api(`/teacher/rooms/${room.code}/start`, {}, TEACHER);
  await next(["start"]);
  for (let roomIndex = 0; roomIndex < 3; roomIndex += 1) {
    for (let index = 0; index < 3; index += 1) await solve();
    let escape = (await state()).self.escape;
    for (const hotspot of escape.hotspots) {
      const result = await send({ type: "escape_action", action: "inspect", seq: escape.seq, hotspotId: hotspot.id }, ["escape_result", "error"]);
      assert.equal(result.type, "escape_result");
      escape = result.room.self.escape;
    }
    if (roomIndex < 2) {
      const code = escape.lockOrder.map((symbol) => escape.hotspots.find((spot) => spot.symbol === symbol).clue).join("");
      const result = await send({ type: "escape_action", action: "unlock", seq: escape.seq, code }, ["escape_result", "error"]);
      assert.equal(result.type, "escape_result");
    }
  }
  const escape = (await state()).self.escape;
  const code = escape.lockOrder.map((symbol) => escape.hotspots.find((spot) => spot.symbol === symbol).clue).join("");
  socket.close(1000, "browser handoff");
  return { roomCode: room.code, playerId: player.playerId, resumeToken: player.resumeToken, code };
}

const [command, value, extra] = process.argv.slice(2);
if (command === "escape-room3") {
  process.stdout.write(JSON.stringify(await prepareEscapeRoom3()));
} else if (command === "create") {
  const mode = { vault: "treasure_heist", maze: "maze_heist", escape: "grammar_escape" }[value];
  assert.ok(mode, "Usage: create vault|maze|escape");
  const room = await api("/teacher/rooms", {
    mode,
    durationSeconds: 600,
    questionCount: questions.length,
    shuffleQuestions: false,
    allowLateJoin: true,
    allowSteal: true,
    allowScoreSwap: true,
    playStyle: value === "escape" ? "team" : "individual",
    ...(value === "escape" ? { teamCount: 2 } : {}),
    customQuestions: questions,
  }, TEACHER);
  process.stdout.write(room.code);
} else if (command === "rivals") {
  assert.match(value || "", /^\d{6}$/, "Usage: rivals ROOM_CODE [COUNT]");
  const count = Number(extra || 1);
  for (let index = 0; index < count; index += 1) {
    await api(`/rooms/${value}/join`, { nickname: `라이벌${Date.now().toString().slice(-4)}-${index + 1}` });
  }
  process.stdout.write(String(count));
} else if (command === "start" || command === "finish") {
  assert.match(value || "", /^\d{6}$/, `Usage: ${command} ROOM_CODE`);
  await api(`/teacher/rooms/${value}/${command}`, {}, TEACHER);
  process.stdout.write("ok");
} else {
  throw new Error("Usage: create vault|maze|escape | rivals ROOM_CODE [COUNT] | start ROOM_CODE | finish ROOM_CODE");
}
