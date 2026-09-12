import assert from 'node:assert/strict';
import {
  ARCHIVE_ORDER,
  CLASSROOM_HOTSPOTS,
  MAZE,
  createInitialState,
  getMazeExit,
  getMazeStart,
  isMazeWalkable,
  reduceState,
} from './game.js';

const step = (state, action) => reduceState(state, action);
const inspectAll = (state, ids) => ids.reduce((current, id) => step(current, { type: 'inspect', id }), state);

let state = createInitialState();
assert.equal(state.scene, 'classroom');
assert.deepEqual(getMazeStart(), { x: 1, y: 1 });
assert.deepEqual(getMazeExit(), { x: 12, y: 7 });
assert.equal(MAZE.every((row) => row.length === 15), true, 'maze rows keep a stable 15-column grid');
assert.equal(isMazeWalkable(1, 1), true);
assert.equal(isMazeWalkable(0, 1), false);

state = inspectAll(state, CLASSROOM_HOTSPOTS.filter((hotspot) => !hotspot.locked).map((hotspot) => hotspot.id));
assert.equal(state.puzzleReady.classroom, true, 'classroom puzzle appears after all spatial clues');
assert.equal(state.inventory.clues.length, 3);
state = step(state, { type: 'set-room-digit', index: 0, value: '5' });
state = step(state, { type: 'set-room-digit', index: 1, value: '2' });
state = step(state, { type: 'set-room-digit', index: 2, value: '8' });
state = step(state, { type: 'solve-room' });
assert.equal(state.scene, 'archive');
assert.deepEqual(state.inventory.keys, ['archive']);

state = inspectAll(state, ['clock', 'books', 'compartment']);
assert.equal(state.puzzleReady.archive, true, 'archive puzzle appears after all spatial clues');
while (state.archiveOrder.join('|') !== ARCHIVE_ORDER.join('|')) {
  const target = ARCHIVE_ORDER.findIndex((id, index) => state.archiveOrder[index] !== id);
  const from = state.archiveOrder.indexOf(ARCHIVE_ORDER[target]);
  state = step(state, { type: 'move-archive', index: from, delta: -1 });
  if (from === 0) state = step(state, { type: 'move-archive', index: 0, delta: 1 });
}
state = step(state, { type: 'solve-archive' });
assert.equal(state.scene, 'maze');
assert.deepEqual(state.inventory.keys, ['archive', 'corridor']);

const beforeWall = { ...state.player };
state = step(state, { type: 'move-maze', direction: 'left' });
assert.deepEqual(state.player, beforeWall, 'wall collision keeps the player in place');

const queue = [{ state, path: [] }];
const seen = new Set([`${state.player.x},${state.player.y}`]);
let winningPath = null;
for (let cursor = 0; cursor < queue.length && !winningPath; cursor += 1) {
  const current = queue[cursor];
  for (const direction of ['up', 'right', 'down', 'left']) {
    const next = step(current.state, { type: 'move-maze', direction });
    if (next.won) {
      winningPath = [...current.path, direction];
      break;
    }
    const marker = `${next.player.x},${next.player.y}`;
    if (next.player !== current.state.player && !seen.has(marker)) {
      seen.add(marker);
      queue.push({ state: next, path: [...current.path, direction] });
    }
  }
}
assert.ok(winningPath?.length, 'maze has a reachable exit');
for (const direction of winningPath) state = step(state, { type: 'move-maze', direction });
assert.equal(state.won, true);
assert.equal(state.lastEvent, 'win');
state = step(state, { type: 'restart' });
assert.deepEqual(state, createInitialState(), 'restart clears rooms, inventory, maze position, and victory');

console.log('PASS: solo escape room clues, unlock chain, maze collision, BFS exit, and restart');
