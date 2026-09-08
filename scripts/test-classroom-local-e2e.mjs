import assert from "node:assert/strict";

const ORIGIN = "http://127.0.0.1:8787";
const TEACHER = "teacher@local.test";
const WRONG_TEACHER = "other-teacher@local.test";
const MODES = ["boss_battle", "bubble_battle", "tower_race", "rangers_siege", "whack_race", "sentence_blast"];
const CUSTOM = Array.from({ length:5 }, (_, index) => ({
  prompt:`Local E2E ${index + 1}: choose answer-${index + 1}`,
  answer:`answer-${index + 1}`,
  choices:[`wrong-${index + 1}`, `answer-${index + 1}`, `other-${index + 1}`],
}));
const answerByPrompt = new Map(CUSTOM.map((question) => [question.prompt, question.answer]));

async function request(path, { teacher, ...init } = {}) {
  const headers = new Headers(init.headers || {});
  if (teacher) headers.set("X-Dev-Teacher-Email", teacher);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(`${ORIGIN}${path}`, { ...init, headers });
}

async function json(response, expected=null) {
  const body = await response.json().catch(() => ({}));
  if (expected === null) assert.ok(response.ok,`HTTP ${response.status}: ${body.error || body.message || "unexpected response"}`);
  else assert.equal(response.status, expected, `HTTP ${response.status}: ${body.error || body.message || "unexpected response"}`);
  return body;
}

class Inbox {
  constructor(socket) {
    this.queue=[]; this.waiters=[];
    socket.addEventListener("message", (event) => {
      const message=JSON.parse(String(event.data));
      const index=this.waiters.findIndex((waiter)=>!waiter.type || waiter.type===message.type);
      const waiter=index>=0 ? this.waiters.splice(index,1)[0] : null;
      if (waiter) waiter.resolve(message); else this.queue.push(message);
    });
    socket.addEventListener("error", () => this.waiters.shift()?.reject(new Error("WebSocket error")));
  }
  next(type, timeoutMs=2500) {
    const existing=this.queue.findIndex((message)=>!type || message.type===type);
    if (existing>=0) return Promise.resolve(this.queue.splice(existing,1)[0]);
    return new Promise((resolve,reject) => {
      const waiter={ type, resolve:(message)=>{ clearTimeout(timer); resolve(message); }, reject };
      const timer=setTimeout(()=>{ const index=this.waiters.indexOf(waiter); if(index>=0)this.waiters.splice(index,1); reject(new Error(`Timed out waiting for ${type || "message"}`)); },timeoutMs);
      this.waiters.push(waiter);
    });
  }
}

async function openStudent(code, nickname) {
  const joined=await json(await request(`/api/rooms/${code}/join`, { method:"POST", body:JSON.stringify({ nickname }) }));
  const ticket=await json(await request(`/api/rooms/${code}/socket-ticket`, {
    method:"POST", headers:{ "X-Resume-Token":joined.resumeToken }, body:JSON.stringify({ playerId:joined.playerId }),
  }));
  const socket=new WebSocket(`ws://127.0.0.1:8787/api/rooms/${code}/ws?ticket=${encodeURIComponent(ticket.ticket)}`);
  await new Promise((resolve,reject)=>{ socket.addEventListener("open",resolve,{once:true}); socket.addEventListener("error",reject,{once:true}); });
  const inbox=new Inbox(socket);
  const hello=await inbox.next("hello");
  return { joined, socket, inbox, hello };
}

function currentQuestion(message) {
  return message?.state?.self?.currentQuestion || message?.room?.self?.currentQuestion || message?.self?.currentQuestion;
}

async function ownState(code, joined) {
  return json(await request(`/api/rooms/${code}/state?role=student&playerId=${encodeURIComponent(joined.playerId)}`, { headers:{ "X-Resume-Token":joined.resumeToken } }));
}

async function runMode(mode) {
  const room=await json(await request("/api/teacher/rooms", {
    teacher:TEACHER, method:"POST", body:JSON.stringify({
      mode, durationSeconds:60, questionCount:5, setTitle:"Local transport fixture",
      customQuestions:CUSTOM, playStyle:"individual", allowLateJoin:true, shuffleQuestions:false,
    }),
  }));
  const students=[];
  try {
    students.push(await openStudent(room.code,`로컬-${MODES.indexOf(mode)+1}-A`));
    students.push(await openStudent(room.code,`로컬-${MODES.indexOf(mode)+1}-B`));
    await json(await request(`/api/teacher/rooms/${room.code}/start`, { teacher:TEACHER, method:"POST" }));
    const starts=await Promise.all(students.map((student)=>student.inbox.next("start")));

    let question=currentQuestion(starts[0]);
    assert.ok(question?.id && Number.isInteger(question.occurrenceIndex));
    students[0].socket.send(JSON.stringify({ type:"answer", questionId:question.id, occurrenceIndex:question.occurrenceIndex, answer:answerByPrompt.get(question.eng) }));
    const first=await students[0].inbox.next("answer_result");
    assert.deepEqual({ correct:first.result.correct, gain:first.result.scoreGain, score:first.result.score }, { correct:true, gain:100, score:100 });
    await students[0].inbox.next("room_state");
    question=currentQuestion(await ownState(room.code,students[0].joined));
    assert.ok(question?.id,"next question missing after first answer");
    students[0].socket.send(JSON.stringify({ type:"answer", questionId:question.id, occurrenceIndex:question.occurrenceIndex, answer:answerByPrompt.get(question.eng) }));
    const second=await students[0].inbox.next("answer_result");
    assert.deepEqual({ correct:second.result.correct, gain:second.result.scoreGain, score:second.result.score }, { correct:true, gain:110, score:210 });

    const peerStartQuestion=currentQuestion(starts[1]);
    students[1].socket.send(JSON.stringify({ type:"answer", questionId:"spoofed-question", occurrenceIndex:peerStartQuestion.occurrenceIndex, answer:CUSTOM[0].answer }));
    const spoof=await students[1].inbox.next("error");
    assert.ok(["INVALID_QUESTION","QUESTION_MISMATCH","STALE_QUESTION","NOT_CURRENT_QUESTION"].includes(spoof.error),`unexpected spoof error ${spoof.error}`);
    const peerView=await ownState(room.code,students[1].joined);
    assert.equal(Number(peerView.self?.score || 0),0,"spoof changed score");

    await json(await request(`/api/teacher/rooms/${room.code}/finish`, { teacher:TEACHER, method:"POST" }));
    const report=await json(await request(`/api/teacher/reports/${room.code}`, { teacher:TEACHER }));
    assert.equal(report.players.length,2);
    assert.deepEqual(report.players.map((player)=>Number(player.rank)).sort(),[1,2]);
    assert.equal(report.room.studentRecordRetention,"session");
    const ttl=Number(report.room.resultExpiresAt)-Date.now();
    assert.ok(ttl>28*60_000 && ttl<=30*60_000+5000,`unexpected result TTL ${ttl}`);

    const own=await ownState(room.code,students[0].joined);
    assert.ok([1,100].includes(Number(own.self?.accuracy)),`unexpected own accuracy ${own.self?.accuracy}`);
    assert.equal(own.leaderboard.length,2);
    assert.deepEqual(own.leaderboard.map((player)=>Number(player.rank)).sort(),[1,2]);
    assert.ok(own.leaderboard.every((player)=>!("accuracy" in player) && !("correctCount" in player)),"peer accuracy leaked");

    assert.equal((await request(`/api/teacher/reports/${room.code}`)).status,401);
    assert.equal((await request(`/api/teacher/reports/${room.code}`, { teacher:WRONG_TEACHER })).status,403);
    return { mode, players:report.players.length, topScore:Math.max(...report.players.map((player)=>Number(player.score || 0))) };
  } finally {
    for (const student of students) student.socket.close(1000,"local test complete");
  }
}

const health=await fetch(`${ORIGIN}/api/auth/session`).catch(()=>null);
assert.ok(health,"Local Worker is not running on 127.0.0.1:8787");
for (const mode of MODES) {
  const result=await runMode(mode);
  console.log(`${result.mode}: ok (${result.players} players, top ${result.topScore})`);
}
console.log(`classroom local e2e: ${MODES.length} modes passed`);
