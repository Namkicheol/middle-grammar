import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createEscapePuzzleDraft,
  escapePuzzleCode,
  escapeRoomExperienceHtml,
  updateEscapePuzzleDraft,
} from "../multiplayer/escape-game.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const escape = {
  roomIndex: 0,
  title: "전력실",
  story: "불이 꺼진 교실 뒤편에서 단서를 찾으세요.",
  focus: 2,
  seq: 4,
  discoveredCount: 3,
  lockOrder: ["moon", "star", "sun"],
  hotspots: [
    { id: "desk", label: "교탁", symbol: "moon", clue: "8" },
    { id: "clock", label: "벽시계", symbol: "star", clue: "2" },
    { id: "cabinet", label: "캐비닛", symbol: "sun", clue: "6" },
  ],
};

const rendered = escapeRoomExperienceHtml({
  escape,
  draft: createEscapePuzzleDraft(escape),
  connected: true,
});
assert.match(rendered, /assets\/escape-polish\/night-classroom\.png/);
assert.match(rendered, /data-action="escape-inspect"/);
assert.match(rendered, /data-action="escape-puzzle-confirm"/);
assert.match(rendered, /ROOM 1/);
assert.match(rendered, /☾.*→.*✦.*→.*☀/);

const unknown = { ...escape, discoveredCount: 0, focus: 0, hotspots: escape.hotspots.map(({ clue, ...spot }) => spot) };
const unknownRendered = escapeRoomExperienceHtml({ escape: unknown, draft: createEscapePuzzleDraft(unknown), connected: true });
assert.doesNotMatch(unknownRendered, />8<|>2<|>6</, "undiscovered digits must stay server-hidden");
assert.match(unknownRendered, /단서 필요|\?/);
assert.match(unknownRendered, /문제 풀고 조사/);

const archive = { ...escape, roomIndex: 1, hotspots: escape.hotspots.map((spot) => ({ ...spot })) };
let archiveDraft = createEscapePuzzleDraft(archive);
archiveDraft = updateEscapePuzzleDraft(archive, archiveDraft, { kind: "move", index: 0, delta: 1 });
assert.equal(escapePuzzleCode(archive, archiveDraft), "286");
archiveDraft = updateEscapePuzzleDraft(archive, archiveDraft, { kind: "move", index: 1, delta: -1 });
assert.equal(escapePuzzleCode(archive, archiveDraft), "826");
assert.match(escapeRoomExperienceHtml({ escape: { ...archive, lockOrder: ["moon", "sun", "star"] }, draft: archiveDraft }), /☾.*→.*☀.*→.*✦/);
assert.match(escapeRoomExperienceHtml({ escape: { ...archive, roomIndex: 2, lockOrder: ["sun", "star", "moon"] }, draft: { roomIndex: 2, values: ["5", "2", "8"] } }), /☀.*→.*✦.*→.*☾/);

const app = read("multiplayer/app.js");
const rendererStart = app.indexOf("function escapePlayView() {");
const rendererEnd = app.indexOf("function studentPlayView() {", rendererStart);
assert.ok(rendererStart >= 0 && rendererEnd > rendererStart, "escape renderer must remain callable");
const rendererSource = app.slice(rendererStart, rendererEnd);
assert.equal((app.match(/function escapePlayView\(\)/g) || []).length, 1, "multiplayer must have one escape renderer");
assert.match(rendererSource, /escapeRoomExperienceHtml/);
assert.match(rendererSource, /escapeQuestionHtml/);
assert.match(rendererSource, /escape-focus-button/);
assert.match(rendererSource, /escapeProgressHtml/);
assert.doesNotMatch(rendererSource, /escape-sidebar/);
assert.match(rendererSource, /<\/article>/);
assert.doesNotMatch(rendererSource, /escape-scene|generateQuestion|Math\.random/);

const socketStart = app.indexOf("function handleSocketMessage(message) {");
const socketEnd = app.indexOf("\nfunction reconnectPanel()", socketStart);
const socketSource = app.slice(socketStart, socketEnd);
assert.match(socketSource, /type === "escape_result"/);
assert.match(app, /function setRoomFromPayload\(payload, options = \{\}\) \{[\s\S]*syncTreasureSnapshot\(room, options\)/, "room snapshots must flow through the shared helper");
assert.match(socketSource, /if \(message\.room \|\| message\.state\) state\.room = setRoomFromPayload\(message\)/, "escape results must resync the server room snapshot");
assert.match(socketSource, /type === "error"[\s\S]*if \(message\.room \|\| message\.state\) state\.room = setRoomFromPayload\(message\)/, "escape errors must preserve server resync");
assert.match(socketSource, /type === "error"[\s\S]*state\.escapeAction = null/);

const index = read("multiplayer/index.html");
assert.match(index, /src="\.\/escape-audio\.js"/);
assert.doesNotMatch(index, /src="\.\.\/escape\/audio\.js"/);
const assetNames = ["night-classroom.png", "night-archive.png", "night-corridor.png"];
for (const name of assetNames) {
  assert.deepEqual(
    readFileSync(resolve(root, "escape/assets", name)),
    readFileSync(resolve(root, "multiplayer/assets/escape-polish", name)),
    `${name} multiplayer distribution copy is stale`,
  );
}
assert.deepEqual(
  readFileSync(resolve(root, "escape/audio.js")),
  readFileSync(resolve(root, "multiplayer/escape-audio.js")),
  "multiplayer audio distribution copy is stale",
);

console.log("multiplayer escape UI: ok");
