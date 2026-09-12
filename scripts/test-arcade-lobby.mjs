import fs from 'node:fs';

const html = fs.readFileSync('game/index.html', 'utf8');
const css = fs.readFileSync('game/arcade-lobby.css', 'utf8');
const modes = ['boss', 'speed', 'whack', 'bubble', 'tower', 'rangers', 'sentence', 'escape'];

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(html.includes('<section class="game-select mode-library"'), 'mode library is not the lobby first step');
assert(html.includes('id="lobby-config" hidden'), 'grade configuration must start hidden');
assert(html.includes('id="unit-section"') && html.includes('id="unit-section" aria-labelledby="unit-heading" hidden'), 'topic configuration must start hidden');
assert(!html.includes('id="mode-summary"'), 'old mode summary must not remain in the art-first lobby');
assert(!html.includes('콤보와 필살기로 보스 격파'), 'mode descriptions should not return as card bodies');
assert(html.includes('lobbyConfig.hidden = false') && html.includes('unitSection.hidden = false'), 'mode selection must reveal configuration');
assert(html.includes("location.href = '../game2/?unit='"), 'boss route contract missing');
assert(html.includes("location.href = '../whack-grammar/?unit='"), 'whack route contract missing');
assert(html.includes("location.href = '../tower/?unit='"), 'tower route contract missing');
assert(html.includes("location.href = '../grammar-rangers/?unit='"), 'rangers route contract missing');
assert(html.includes("location.href = '../sentence-blast/?unit='"), 'sentence route contract missing');
assert(html.includes("location.href = '../escape/'"), 'escape route contract missing');
for (const mode of modes) {
  assert(html.includes(`data-mode="${mode}"`), `mode button missing: ${mode}`);
  assert(css.includes(`data-mode="${mode}"] .mode-thumb`), `cover art selector missing: ${mode}`);
}
assert(css.includes('.mode-thumb{position:absolute;') && css.includes('.mode-copy{position:absolute;'), 'cover art titles are not layered');

console.log('PASS: art-first arcade lobby and mode-selection contracts');
