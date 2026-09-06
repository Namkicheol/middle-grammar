// Fast rendering/ordering regressions; real browser interaction is a separate check.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const file = new URL('../../multiplayer/app.js', import.meta.url);
const source = fs.readFileSync(file, 'utf8')
  .replace(/^import .*?;\n/, '')
  .replace(/render\(\);\nrestoreStudentSession\(\);\s*$/, '');
const context = vm.createContext({
  document: { querySelector: () => null },
  window: { addEventListener() {} },
  location: { search: '', hostname: '127.0.0.1', origin: 'http://127.0.0.1:8787', href: 'http://127.0.0.1:8787/multiplayer/' },
  URL, URLSearchParams, Date,
});
vm.runInContext(source + '\n render = () => {}; globalThis.qa = {state,handleSocketMessage,sortedEscapePlayers,sortedEscapeTeams,syncEscapeCode,escapePlayView,studentEscapeResultView};', context);
const q = context.qa;
const now = Date.now();
const lowScoreEscaped = { rank: 1, nickname: '탈출', score: 10, escape: { roomsCleared: 3, discoveredCount: 3, escapedAt: now } };
const highScoreExploring = { rank: 2, nickname: '탐색', score: 9999, escape: { roomsCleared: 0, discoveredCount: 1 } };
assert.equal(q.sortedEscapePlayers([highScoreExploring, lowScoreEscaped])[0].nickname, '탈출');
assert.equal(q.sortedEscapeTeams([highScoreExploring, lowScoreEscaped])[0].nickname, '탈출');
q.state.escapeCode = '073';
q.syncEscapeCode({ roomIndex: 0, roomsCleared: 0 }, { roomIndex: 0, roomsCleared: 0 });
assert.equal(q.state.escapeCode, '073', 'Unrelated broadcast must preserve code');
q.syncEscapeCode({ roomIndex: 0, roomsCleared: 0 }, { roomIndex: 1, roomsCleared: 1 });
assert.equal(q.state.escapeCode, '', 'New team stage must clear old code');

q.state.role = 'student'; q.state.connectionState = 'connected';
q.state.room = {
  mode: 'grammar_escape', status: 'playing', playStyle: 'individual', durationSeconds: 600,
  startedAt: now - 20000, questionCount: 5, leaderboard: [highScoreExploring, lowScoreEscaped],
  self: {
    nickname: '검증', correctCount: 3, answeredCount: 4, accuracy: 0.75,
    currentQuestion: { id: 'q1', occurrenceIndex: 0, eng: 'I ___ ready.', kor: '나는 준비됐다.', opts: ['am', 'is', 'are', 'be'] },
    escape: { roomIndex: 0, roomsCleared: 0, focus: 0, seq: 1, totalRooms: 3, title: '교실', discoveredCount: 3,
      lockOrder: ['star', 'moon', 'sun'], hotspots: [
        { id: 'desk', label: '교탁', symbol: 'moon', clue: '0' },
        { id: 'board', label: '칠판', symbol: 'star', clue: '7' },
        { id: 'locker', label: '사물함', symbol: 'sun', clue: '3' },
      ] },
  },
};
const html = q.escapePlayView();
q.state.escapeCode = '073';
q.state.escapeBusy = true;
q.state.escapeAction = { action: 'inspect', hotspotId: 'board' };
q.handleSocketMessage({ type: 'hello', room: q.state.room });
assert.equal(q.state.escapeBusy, false, 'Authoritative reconnect must release lost-response busy state');
assert.equal(q.state.escapeAction, null);
assert.equal(q.state.escapeCode, '073', 'Same-stage reconnect preserves entered code');
const advancedRoom = JSON.parse(JSON.stringify(q.state.room));
advancedRoom.self.escape.roomIndex = 1;
advancedRoom.self.escape.roomsCleared = 1;
q.handleSocketMessage({ type: 'hello', room: advancedRoom });
assert.equal(q.state.escapeCode, '', 'Reconnect after team advancement clears stale code');
assert(html.includes('I ___ ready.'));
assert(html.includes('문제 풀기'));
const notebook = html.slice(html.indexOf('class="clue-lines"'), html.indexOf('</ol>', html.indexOf('class="clue-lines"')));
assert(notebook.indexOf('>0</strong>') < notebook.indexOf('>7</strong>'), 'Notebook must not pre-sort digits into lock code');
q.state.room.self.escape.escapedAt = now;
q.state.room.self.escape.roomsCleared = 3;
q.state.room.self.currentQuestion = undefined;
assert(!q.escapePlayView().includes('data-action="answer"'), 'Escaped UI must not offer new questions');
assert(q.studentEscapeResultView().includes('75%'), 'Own accuracy remains visible');
console.log('PASS: escape UI server-rank ordering, reconnect recovery, code preservation, clue puzzle order, onboarding, completion and own accuracy');
