import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [wrapperCss, towerHtml] = await Promise.all([
  readFile(new URL("../multiplayer/classroom.css", import.meta.url), "utf8"),
  readFile(new URL("../tower/index.html", import.meta.url), "utf8"),
]);

// The classroom page is a viewport-owned shell; legacy header/footer must not
// reduce the iframe height at any of the supported gameplay viewports.
assert.match(wrapperCss, /body:has\(\.classroom-host\) > \.site-header[\s\S]*?\.site-footer\s*\{\s*display:none/);
assert.match(wrapperCss, /body:has\(\.classroom-host\) #app\s*\{[^}]*width:100%[^}]*min-height:100svh[^}]*padding:0/);
assert.match(wrapperCss, /\.classroom-host\s*\{[^}]*display:flex[^}]*height:100svh[^}]*min-height:0/);
assert.match(wrapperCss, /\.classroom-hud\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\) auto/);
assert.match(wrapperCss, /\.classroom-frame-wrap\s*\{[^}]*flex:1 1 auto[^}]*min-height:0[^}]*height:auto/);
assert.match(wrapperCss, /\.classroom-ranks\s*\{[^}]*flex:0 0 auto/);
assert.match(wrapperCss, /\.classroom-ranks\[open\]\s*\{[^}]*max-height:110px[^}]*overflow:hidden/);
assert.match(wrapperCss, /\.classroom-ranks ol\s*\{[^}]*max-height:54px[^}]*overflow-y:auto/);
assert.doesNotMatch(wrapperCss, /\.classroom-frame-wrap[^}]*min-height:460px/);
assert.doesNotMatch(wrapperCss, /\.classroom-frame-wrap[^}]*min-height:390px/);

// A short landscape iframe must also compact the Tower card so all options
// remain in the child viewport even after an item or feedback strip appears.
assert.match(towerHtml, /@media\s*\(max-height:600px\)\s*and\s*\(orientation:landscape\)/);
assert.match(towerHtml, /@media[\s\S]*?max-height:600px[\s\S]*?#opts\{gap:6px\}/);
assert.match(towerHtml, /@media[\s\S]*?max-height:600px[\s\S]*?#game #opts > \.opt\{min-height:40px/);

console.log("PASS: classroom viewport shell and short-landscape Tower layout contracts");
