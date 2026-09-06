// Live local HTTP/WebSocket integration; never run against a remote environment.
import assert from 'node:assert/strict';

const origin = process.argv[2] || 'http://127.0.0.1:8787';
const parsed = new URL(origin);
assert(['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname), 'Local dev only');
const sockets = [];
const teacherHeaders = { 'X-Dev-Teacher-Email': 'escape-qa@local.test' };
async function api(path, body, headers = {}) {
  const r = await fetch(origin + '/api' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await r.json();
  assert(r.ok, `${path}: ${r.status} ${JSON.stringify(data)}`);
  return data;
}
async function connect(code, player) {
  const { ticket } = await api(`/rooms/${code}/socket-ticket`, { playerId: player.playerId }, { 'X-Resume-Token': player.resumeToken });
  const ws = new WebSocket(origin.replace(/^http/, 'ws') + `/api/rooms/${code}/ws?ticket=${encodeURIComponent(ticket)}`);
  sockets.push(ws);
  let pending;
  const client = { ws, room: null, request(payload) {
    assert(!pending, 'One pending action per client');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending = null; reject(new Error('WS response timeout')); }, 5000);
      pending = { resolve, reject, timer };
      ws.send(JSON.stringify(payload));
    });
  } };
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WS hello timeout')), 5000);
    ws.addEventListener('error', () => reject(new Error('WS connection error')), { once: true });
    ws.addEventListener('message', ({ data }) => {
      const event = JSON.parse(data);
      if (event.room || event.state) client.room = event.room || event.state;
      if (event.type === 'hello') { clearTimeout(timer); resolve(); }
      if (pending && ['answer_result', 'escape_result', 'error'].includes(event.type)) {
        const request = pending; pending = null; clearTimeout(request.timer); request.resolve(event);
      }
    });
  });
  return client;
}
async function state(code, player) {
  return api(`/rooms/${code}/state?playerId=${player.playerId}`, undefined, { 'X-Resume-Token': player.resumeToken });
}
async function solve(code, player, client) {
  const current = await state(code, player);
  const q = current.self.currentQuestion;
  assert(q && q.opts.includes('am'));
  const r = await client.request({ type: 'answer', questionId: q.id, occurrenceIndex: q.occurrenceIndex, answer: 'am' });
  assert.equal(r.type, 'answer_result');
  assert.equal(r.result.correct, true);
}
async function create(playStyle) {
  return api('/teacher/rooms', {
    mode: 'grammar_escape', playStyle, ...(playStyle === 'team' ? { teamCount: 2 } : {}),
    durationSeconds: 300, questionCount: 5, shuffleQuestions: false,
    customQuestions: Array.from({ length: 5 }, (_, i) => ({ prompt: `I ___ ready. (${i + 1})`, answer: 'am', choices: ['am', 'is', 'are', 'be'] })),
  }, teacherHeaders);
}
async function run() {
  const { code } = await create('individual');
  const player = await api(`/rooms/${code}/join`, { nickname: '탈출검증' });
  const peer = await api(`/rooms/${code}/join`, { nickname: '진행검증' });
  const client = await connect(code, player);
  await api(`/teacher/rooms/${code}/start`, {}, teacherHeaders);
  for (let room = 0; room < 3; room++) {
    for (let i = 0; i < 3; i++) await solve(code, player, client);
    let view = await state(code, player);
    assert.equal(view.self.escape.roomsCleared, room);
    assert(view.self.escape.hotspots.every(h => h.clue === undefined));
    for (let i = 0; i < 3; i++) {
      const e = view.self.escape;
      const r = await client.request({ type: 'escape_action', action: 'inspect', seq: e.seq, hotspotId: e.hotspots[i].id });
      assert.equal(r.type, 'escape_result'); view = r.room;
    }
    const e = view.self.escape;
    const codeGuess = e.lockOrder.map(symbol => e.hotspots.find(h => h.symbol === symbol).clue).join('');
    const unlocked = await client.request({ type: 'escape_action', action: 'unlock', seq: e.seq, code: codeGuess });
    assert.equal(unlocked.type, 'escape_result');
    assert.equal(unlocked.room.self.escape.roomsCleared, room + 1);
  }
  const completed = await state(code, player);
  assert(completed.self.escape.escapedAt);
  assert.equal(completed.self.currentQuestion, undefined);
  assert.equal((await state(code, peer)).self.escape.roomsCleared, 0);
  await api(`/teacher/rooms/${code}/finish`, {}, teacherHeaders);
  const report = await api(`/teacher/reports/${code}`, undefined, teacherHeaders);
  assert.equal(report.players.find(p => p.nickname === '탈출검증').escape.roomsCleared, 3);
  console.log('PASS: live individual 3-room escape, private clues, isolation, completion and D1 report');

  const teamRoom = await create('team');
  const players = [];
  for (const nickname of ['팀원가', '팀원나', '팀원다']) players.push(await api(`/rooms/${teamRoom.code}/join`, { nickname }));
  await api(`/teacher/rooms/${teamRoom.code}/start`, {}, teacherHeaders);
  const views = await Promise.all(players.map(p => state(teamRoom.code, p)));
  const sameTeam = views.findIndex((v, i) => i > 0 && v.self.teamId === views[0].self.teamId);
  assert(sameTeam > 0);
  const otherTeam = views.findIndex((v, i) => i > 0 && v.self.teamId !== views[0].self.teamId);
  const a = await connect(teamRoom.code, players[0]), b = await connect(teamRoom.code, players[sameTeam]);
  await solve(teamRoom.code, players[0], a);
  const shared = (await state(teamRoom.code, players[sameTeam])).self.escape;
  assert.equal(shared.focus, 1);
  assert.equal((await state(teamRoom.code, players[otherTeam])).self.escape.focus, 0);
  const action = { type: 'escape_action', action: 'inspect', seq: shared.seq, hotspotId: shared.hotspots[0].id };
  const results = await Promise.all([a.request(action), b.request(action)]);
  assert.equal(results.filter(r => r.type === 'escape_result').length, 1);
  assert.equal(results.filter(r => r.type === 'error').length, 1);
  assert.equal((await state(teamRoom.code, players[0])).self.escape.focus, 0);
  await api(`/teacher/rooms/${teamRoom.code}/finish`, {}, teacherHeaders);
  console.log('PASS: live team shared focus, team isolation and simultaneous inspection single charge');
}
try { await run(); } finally { for (const socket of sockets) socket.close(); }
