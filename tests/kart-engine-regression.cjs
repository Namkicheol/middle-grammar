const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const noop = () => {};
const grad = { addColorStop: noop };
const ctx = new Proxy({}, { get: (_, key) => key === 'createLinearGradient' ? () => grad : noop, set: () => true });
const canvas = { getContext: () => ctx, getBoundingClientRect: () => ({ width: 600, height: 400 }) };
let now = 0, next;
const sandbox = { console, Math, window: { addEventListener: noop, removeEventListener: noop }, document: { hidden: false, addEventListener: noop, removeEventListener: noop }, performance: { now: () => now }, requestAnimationFrame: cb => (next = cb, 1), cancelAnimationFrame: noop, GAME_QUESTIONS: { test: { questions: [{ id:'q', eng:'A', opts:['A','B','C','D'], ans:'A' }] } } };
const source = fs.readFileSync('grammar-kart/solo-race.js','utf8').replace('return { start, stop, destroy, answer, useItem,', 'return { fixture: { setLane: value => lane = value, setOpponent: (i, d, l) => { ai[i].distance = d; ai[i].lane = l; }, gateAt: () => gate?.at, setShield: (i, seconds) => ai[i].shieldUntil = elapsed + seconds, ai: i => ai[i], addCourse: event => course.push(event) }, start, stop, destroy, answer, useItem,');
vm.runInNewContext(source, sandbox);
function race(extra = {}) { now = 0; next = null; const events=[]; const r=sandbox.window.GrammarKart.createRace({canvas, lesson:'test', onEvent: e=>events.push(e), ...extra}); r.start(); return {r,events}; }
function tick(seconds) { for (let i=0;i<seconds*10;i++) { now+=100; const cb=next; if (cb) cb(now); } }
{
 const {r,events}=race(); assert.equal(r.getState().total,5400); assert(r.getState().standings.some(o=>!o.me && o.distance>0)); tick(5); assert(!events.some(e=>e.kind==='contact')); r.setProgress(1799); tick(1); assert.equal(r.getState().lap,2); assert(r.getState().lapDistance < 100); r.setProgress(5399); tick(1); assert(r.getState().finished); assert.equal(r.getState().distance,5400); r.destroy();
}
{
 const {r,events}=race({laps:1}); assert.equal(r.getState().total,1800); r.setProgress(449); tick(1); assert(r.question); r.fixture.setLane(-.55); r.setProgress(739); tick(.2); assert(events.some(e=>e.kind==='hit' && e.distance===740), 'reading section retains hazards'); tick(2); const before=events.length; r.setProgress(790); r.fixture.setOpponent(0,792,0); r.fixture.setLane(0); tick(.2); assert(events.slice(before).some(e=>e.kind==='contact'), 'kart contact remains active during gate'); tick(2); assert(!events.slice(before).some(e=>['hit','banana_hit'].includes(e.kind) && Math.abs(e.distance-810)<56)); r.destroy();
}
{
 const {r}=race(); assert.equal(r.useWeapon('ice'),false); assert.equal(r.useWeapon('missile'),false); r.destroy();
}
{
 const {r}=race();
 // Collect four actual course boxes, using the first three items, then ice.
 for (let i=0;i<3;i++) {
   r.fixture.setLane(-.55); r.setProgress(182); tick(.2);
   const item=r.getState().heldItem; assert(item);
   if (item==='missile') r.fixture.setOpponent(0,r.getState().distance+60,0);
   assert(r.useWeapon(item), item); tick(1);
 }
 r.fixture.setLane(-.55); r.setProgress(182); tick(.2);
 assert.equal(r.getState().heldItem,'shield'); assert(r.useWeapon('shield'));
 // Box rotation starts banana, missile, ice, shield: repeat to reach ice.
 for (let i=0;i<2;i++) { r.fixture.setLane(-.55); r.setProgress(182); tick(.2); const item=r.getState().heldItem; if(item==='missile') r.fixture.setOpponent(0,r.getState().distance+60,0); assert(r.useWeapon(item)); }
 r.fixture.setLane(-.55); r.setProgress(182); tick(.2); assert.equal(r.getState().heldItem,'ice');
 r.fixture.setOpponent(0,r.getState().distance+60,0); assert(r.useWeapon('ice')); assert(r.getState().standings.some(o=>o.frozen)); r.destroy();
}
{
 let count=0; const {r}=race({onQuestion:()=>count++});
 for(let lap=0;lap<3;lap++) for(const mark of [450,900,1350]) {
   r.setProgress(lap*1800+mark-1); tick(.2); assert(r.question, `question ${lap}:${mark}`); r.answer('A');
 }
 assert.equal(count,9); r.destroy();
}
{
 const long = {id:'long',eng:'long '.repeat(40),opts:['A','B','C','D'],ans:'A'};
 for(const kind of ['cone','banana','barrier','oil','roadblock']) for(const offset of [-55,0,55]) {
   const {r,events}=race({mode:'solo'}); r.setProgress(449); tick(.2);
   r.setGateQuestion(long,99); const at=r.fixture.gateAt();
   r.fixture.addCourse({at:at+offset,lane:0,kind}); r.fixture.setLane(0); r.setProgress(at+offset-1); tick(.2);
   assert(!events.some(e=>e.distance===at+offset && ['hit','banana_hit'].includes(e.kind)), `${kind} offset ${offset}`); r.destroy();
 }
}
{
 const {r}=race();
 // Obtain missile from normal boxes; no target must preserve it.
 r.fixture.setLane(-.55); r.setProgress(182); tick(.2); assert.equal(r.getState().heldItem,'banana'); assert(r.useWeapon('banana'));
 r.fixture.setLane(-.55); r.setProgress(182); tick(.2); assert.equal(r.getState().heldItem,'missile');
 for(let i=0;i<8;i++) r.fixture.setOpponent(i,-1000,0);
 assert.equal(r.useWeapon('missile'),false); assert.equal(r.getState().heldItem,'missile');
 r.fixture.setOpponent(0,r.getState().distance+50,0); assert(r.useWeapon('missile')); tick(1);
 assert(r.fixture.ai(0).slowUntil > 0, 'missile impact slows target');
 r.fixture.setLane(-.55); r.setProgress(182); tick(.2); assert.equal(r.getState().heldItem,'ice');
 r.fixture.setOpponent(0,r.getState().distance+50,0); r.fixture.setShield(0,5); assert(r.useWeapon('ice'));
 assert.equal(r.fixture.ai(0).frozenUntil||0,0, 'shield blocks ice'); assert.equal(r.fixture.ai(0).shieldUntil,0);
 // Rotate boxes to a second missile and verify its impact consumes shield without slowing.
 for (const expected of ['shield','banana','missile']) { r.fixture.setLane(-.55); r.setProgress(182); tick(.2); assert.equal(r.getState().heldItem,expected); if(expected !== 'missile') assert(r.useWeapon(expected)); }
 r.fixture.ai(0).slowUntil=0; r.fixture.setOpponent(0,r.getState().distance+50,0); r.fixture.setShield(0,5); assert(r.useWeapon('missile')); tick(1); assert.equal(r.fixture.ai(0).shieldUntil,0); assert.equal(r.fixture.ai(0).slowUntil,0, 'shield blocks missile'); r.destroy();
}
{
 const center=sandbox.window.GrammarKart.courseCenter;
 for(const map of ['coastal','hill','neon','snow']) {
   for(const at of [0,123,450,999,1799]) {
     assert(Math.abs(center(map,at)-center(map,at+1800))<1e-9, `${map} lap 2 minimap`);
     assert(Math.abs(center(map,at)-center(map,at+3600))<1e-9, `${map} lap 3`);
   }
   const slope=at=>(center(map,at+0.01)-center(map,at-0.01))/.02;
   assert(Math.abs(center(map,1800-0.001)-center(map,1800+0.001))<.01, `${map} boundary position`);
   assert(Math.abs(slope(1800-0.001)-slope(1800+0.001))<.0001, `${map} boundary slope`);
 }
}
console.log('kart engine regression: passed');
