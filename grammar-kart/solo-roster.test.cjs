const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const noop = () => {};
const window = { addEventListener: noop, removeEventListener: noop };
const document = { hidden: true, addEventListener: noop, removeEventListener: noop };
runInNewContext(readFileSync(require('node:path').join(__dirname, 'solo-race.js'), 'utf8'), { window, document, console, Math, Set, Map, cancelAnimationFrame: noop });
const designs = ['teal','fox','robot','owl','raccoon','digger','penguin','frog','rabbit'];
const canvas = { getContext: () => ({}), getBoundingClientRect: () => ({width: 0, height: 0}) };
for (const design of designs) {
  for (let round = 0; round < 2; round++) {
    const race = window.GrammarKart.createRace({ canvas, lesson: '', kartDesign: design });
    const rows = race.getState().standings;
    assert.equal(rows.length, 9);
    assert.equal(rows.filter(row => row.me).length, 1);
    assert.equal(rows.find(row => row.me).design, design);
    assert.equal(new Set(rows.map(row => row.design)).size, 9);
    assert.equal(rows.filter(row => !row.me && row.design === design).length, 0);
    race.destroy();
  }
}
console.log('Nine unique racers verified for all choices and fresh races.');
