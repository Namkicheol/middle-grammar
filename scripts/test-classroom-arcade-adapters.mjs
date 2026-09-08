import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const cases = [
  ['game/index.html', './classroom-bridge.js'],
  ['whack-grammar/index.html', '../game/classroom-bridge.js'],
  ['sentence-blast/index.html', '../game/classroom-bridge.js'],
];

for (const [file, src] of cases) {
  const html = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  const bridgeAt = html.indexOf(`<script src="${src}"></script>`);
  const adapterAt = html.indexOf('const classroomMode', bridgeAt);
  assert.ok(bridgeAt >= 0 && adapterAt > bridgeAt, `${file}: bridge must load before adapter`);
  assert.match(html, /ClassroomMatch\.ready/, `${file}: waits for teacher start`);
  assert.match(html, /ClassroomMatch\.getQuestion\(\)/, `${file}: renders server questions`);
  assert.match(html, /ClassroomMatch\.answer\(/, `${file}: submits selected text for server judgment`);
  assert.match(html, /ClassroomMatch\.onFinish\(/, `${file}: stops at the shared finish`);
  assert.match(html, /ClassroomMatch\.remainingMs\(\)/, `${file}: reads the shared deadline`);
}

const bubble = await readFile(new URL('../game/index.html', import.meta.url), 'utf8');
assert.match(bubble, /shotsTowardQuiz >= SHOTS_PER_QUIZ/, 'bubble: preserves the eight-shot quiz cadence');
assert.match(bubble, /serverResult\.correctAnswer/, 'bubble: reveals the authoritative answer');

const whack = await readFile(new URL('../whack-grammar/index.html', import.meta.url), 'utf8');
assert.match(whack, /pendingOpts = shuffle\(q\.opts\.slice\(\)\)/, 'whack: uses server options for moles');
assert.match(whack, /serverResult\.correctAnswer/, 'whack: reveals the authoritative answer');
assert.match(whack, /`푼 문제 \$\{qIdx\}`/, 'whack: classroom progress counts completed answers');

const sentence = await readFile(new URL('../sentence-blast/index.html', import.meta.url), 'utf8');
assert.match(sentence, /challengeKind='choice'/, 'sentence blast: classroom questions use choice mode');
assert.match(sentence, /serverResult\.correctAnswer/, 'sentence blast: reveals the authoritative answer');
assert.match(sentence, /phaseRemaining=classroomMode\?8:PLAY_PHASE_SECONDS/, 'sentence blast: gives eight seconds of block play after each classroom answer');
assert.match(sentence, /if\(classroomFinished\|\|phase==='over'\)return/, 'sentence blast: delayed rewards cannot resume a finished match');

console.log('Classroom arcade adapters verified.');
