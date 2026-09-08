import assert from "node:assert/strict";
import { createEscapePuzzleDraft, escapePuzzleCode, updateEscapePuzzleDraft } from "../../multiplayer/escape-game.js";

const hotspots = [
  { id: "desk", symbol: "moon", clue: "1" },
  { id: "board", symbol: "star", clue: "2" },
  { id: "locker", symbol: "sun", clue: "3" },
];

const power = { roomIndex: 0, lockOrder: ["star", "moon", "sun"], hotspots };
let draft = createEscapePuzzleDraft(power);
draft = updateEscapePuzzleDraft(power, draft, { kind: "set", index: 0, value: "2" });
draft = updateEscapePuzzleDraft(power, draft, { kind: "set", index: 1, value: "1" });
draft = updateEscapePuzzleDraft(power, draft, { kind: "set", index: 2, value: "3" });
assert.equal(escapePuzzleCode(power, draft), "213", "power sockets derive the server code");

const archive = { roomIndex: 1, lockOrder: ["moon", "sun", "star"], hotspots };
draft = createEscapePuzzleDraft(archive);
draft = updateEscapePuzzleDraft(archive, draft, { kind: "move", index: 2, delta: -1 });
draft = updateEscapePuzzleDraft(archive, draft, { kind: "move", index: 1, delta: -1 });
assert.deepEqual(draft.values, ["locker", "desk", "board"]);
draft = updateEscapePuzzleDraft(archive, draft, { kind: "move", index: 0, delta: 1 });
assert.equal(escapePuzzleCode(archive, draft), "132", "archive tile order derives its code");

const exit = { roomIndex: 2, lockOrder: ["sun", "star", "moon"], hotspots };
draft = createEscapePuzzleDraft(exit);
draft = updateEscapePuzzleDraft(exit, draft, { kind: "spin", index: 0, delta: -1 });
assert.deepEqual(draft.values, ["9", "", ""], "rotary dial wraps backward without deadlocking");
assert.notEqual(createEscapePuzzleDraft({ ...exit, roomIndex: 0 }, draft), draft, "room advance replaces stale input");

console.log("PASS: escape power sockets, archive ordering, rotary dials, and room draft reset");
