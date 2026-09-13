import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../multiplayer/app.js", import.meta.url), "utf8");
const effects = fs.readFileSync(new URL("../multiplayer/treasure-effects.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../multiplayer/entry.css", import.meta.url), "utf8");

const eventKinds = [
  "safe_bonus", "loot", "share", "trap", "double", "triple", "donate", "gift", "angel", "global_bomb",
];
for (const kind of eventKinds) {
  assert.match(app, new RegExp(`${kind}:`), `event label missing: ${kind}`);
  assert.match(effects, new RegExp(`${kind}:`), `sound effect missing: ${kind}`);
}

assert.match(app, /lastTreasureEvent/);
assert.match(app, /affectedPlayers/);
assert.match(app, /scoreBefore/);
assert.match(app, /scoreAfter/);
assert.match(app, /unbankedBefore/);
assert.match(app, /unbankedAfter/);
assert.match(app, /treasureEventSnapshotReady/);
assert.match(app, /treasureSoundedIds/);
assert.match(app, /data-action="toggle-treasure-event"/);
assert.match(app, /서버가 확정한 실제 변화/);
assert.match(app, /확정 점수/);
assert.match(app, /미확정 보물/);
assert.match(app, /strategy === "mystery"/);
assert.match(app, /행운 상자/);
assert.match(app, /배수·랜덤 친구 선물·아주 드문 전체 초기화/);

const socketHandler = app.slice(app.indexOf('function handleSocketMessage'), app.indexOf('function handleMazeKeydown'));
assert.match(socketHandler, /type === "hello"/);
assert.match(socketHandler, /setRoomFromPayload\(message\)/);
assert.match(socketHandler, /type === "room_state"/);
assert.match(socketHandler, /play: type === "room_state"/);
assert.match(socketHandler, /type === "treasure_result"/);
assert.match(socketHandler, /syncTreasureResultEvent\(explicitEvent, \{ play: true \}\)/);
assert.doesNotMatch(socketHandler, /if \(!result\.event\) playModeSound/);

assert.match(effects, /createDynamicsCompressor/);
assert.match(effects, /muteTreasureEffects/);
assert.doesNotMatch(effects, /setInterval/);
assert.match(css, /treasure-event-card/);
assert.match(css, /treasure-event-toggle/);
assert.match(css, /min-height:44px/);
assert.match(css, /treasure-event-change[^}]*font-size:16px/);
assert.match(css, /treasure-mystery-note/);

console.log("treasure UI regression: contract, persistent event card, mystery guidance, deduped audio, mute path, and 390px touch sizing present");
