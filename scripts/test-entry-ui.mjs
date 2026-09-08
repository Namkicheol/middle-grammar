import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, app, css] = await Promise.all([
  readFile(new URL("../multiplayer/index.html", import.meta.url), "utf8"),
  readFile(new URL("../multiplayer/app.js", import.meta.url), "utf8"),
  readFile(new URL("../multiplayer/entry.css", import.meta.url), "utf8"),
]);

assert.match(html, /href="\.\/entry\.css"/);
assert.doesNotMatch(html, /class="brand-mark"/);
assert.match(app, /data-action="choose-student"/);
assert.match(app, /Google로 교사 가입·로그인/);
assert.match(app, /처음 이용하면 교사 가입 · 기존 계정은 바로 로그인/);
assert.doesNotMatch(app, /승인된 교사 계정만/);
assert.match(app, /state\.teacherSession\?\.configured !== true/);
assert.match(app, /classList\.toggle\("entry-mode"/);
assert.match(css, /arcade-20260908\/boss\.webp/);
assert.match(css, /@media\s*\(max-width:390px\)/);


console.log("entry UI contract: ok");
