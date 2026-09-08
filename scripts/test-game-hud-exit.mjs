import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const file of ["tower/index.html", "grammar-rangers/index.html"]) {
  const html = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  assert.match(html, /id="hud-exit"[^>]*aria-label="게임을 멈추고 목록으로 돌아가기"/, `${file}: active HUD exit is accessible`);
  assert.match(html, /\.hud-exit\{[^}]*min-height:44px/, `${file}: exit tap target is at least 44px`);
  assert.match(html, /if\(!window\.confirm\(message\)\)\{[^}]*return;/, `${file}: cancel returns without leaving`);
  assert.match(html, /if\(classroomOn\(\)\|\|!GS\|\|GS\.over\)return;/, `${file}: classroom mode cannot trigger the solo leave flow`);
  assert.match(html, /\$\('hud-exit'\)\.hidden=classroomOn\(\)/, `${file}: classroom host retains navigation control`);
  assert.match(html, /location\.href='\.\.\/game\/index\.html'/, `${file}: standalone mode returns to the game list`);
}

console.log("PASS: tower and rangers persistent HUD exit, confirmation, cancel, and classroom guard");
