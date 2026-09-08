import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const relative of ["game2/index.html", "tower/index.html", "grammar-rangers/index.html"]) {
  const html = await readFile(path.join(root, relative), "utf8");
  const bridge = html.indexOf('<script src="../game/classroom-bridge.js"></script>');
  const gameCode = html.lastIndexOf("<script>");
  assert.ok(bridge > 0 && bridge < gameCode, `${relative}: bridge must load before game code`);
  assert.match(html, /classroom\.ready\.then/, `${relative}: waits for the teacher start`);
  assert.match(html, /await classroom\.getQuestion\(\)/, `${relative}: uses server-safe questions`);
  assert.match(html, /await classroom\.answer\([^)]*,(?:chosen|val|null)\)/, `${relative}: submits answers to the server`);
  assert.match(html, /result\?Boolean\(result\.correct\)/, `${relative}: gameplay uses authoritative correctness`);
  assert.match(html, /result\??\.correctAnswer/, `${relative}: reveals only the authoritative answer`);
  assert.match(html, /classroom\.onFinish\(stopForClassroomFinish\)/, `${relative}: handles the shared deadline`);
  assert.match(html, /classroomFinished=true/, `${relative}: finish handler permanently halts the attempt`);
  assert.match(html, /1500/, `${relative}: local defeat resets without ending the classroom match`);
  assert.doesNotMatch(html, /classroom\.answer\([^\n]+\.ans/, `${relative}: local answer keys must not be submitted as outcomes`);
}

const boss = await readFile(path.join(root, "game2/index.html"), "utf8");
assert.match(boss, /function classroomFairStatus\(key\)\{return !classroomOn\(\)\|\|!\['FREEZE','SHOCK'\]\.includes\(key\);\}/,
  "classroom boss battles must exclude timer and option-order status effects");
assert.match(boss, /Object\.keys\(STATUS_FX\)\.filter\(classroomFairStatus\)/,
  "random classroom status selection must use the fair status filter");
assert.match(boss, /sig\.status && classroomFairStatus\(sig\.status\)/,
  "boss-specific classroom status selection must use the fair status filter");
assert.match(boss, /!sig\.tag \|\| !classroomFairStatus\(sig\.status\)/,
  "classroom mode must not announce a disabled answer-affecting status");

const rangers = await readFile(path.join(root, "grammar-rangers/index.html"), "utf8");
assert.match(rangers, /questionCadence\/\(classroomOn\(\)\?1:g\.speed\)/,
  "classroom question cadence must not change with combat speed");
assert.match(rangers, /if\(classroomOn\(\)\)\{\$\('spd-btn'\)\.disabled=true;\$\('spd-btn'\)\.hidden=true;\}/,
  "classroom speed control must be unavailable");
assert.match(rangers, /if\(classroomOn\(\)\|\|!GS\|\|GS\.over\)return/,
  "classroom speed click handler must be inert");

console.log("classroom game adapter checks passed");
