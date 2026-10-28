const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const noop = () => {};
const grad = { addColorStop: noop };
const ctx = new Proxy({}, { get: (_, key) => key === 'createLinearGradient' ? () => grad : noop, set: () => true });
const canvas = { getContext: () => ctx, getBoundingClientRect: () => ({ width: 600, height: 400 }) };
let now = 0, next;
const sandbox = { console, Math, window: { addEventListener: noop, removeEventListener: noop }, document: { hidden: false, addEventListener: noop, removeEventListener: noop }, performance: { now: () => now }, requestAnimationFrame: cb => (next = cb, 1), cancelAnimationFrame: noop, GAME_QUESTIONS: { test: { questions: Array.from({length:30}, (_, i) => ({ id:'q'+i, eng:'A', opts:['A','B','C','D'], ans:'A' })) } } };
const source = fs.readFileSync('grammar-kart/solo-race.js','utf8').replace('function draw() {', 'function draw() { return;').replace('return { start, stop, destroy, answer, useItem,', 'return { fixture: { setLane: value => lane = value, clearShield: () => shieldUntil = 0, setOpponent: (i, d, l) => { ai[i].distance = d; ai[i].lane = l; }, gateAt: () => gate?.at, setShield: (i, seconds) => ai[i].shieldUntil = elapsed + seconds, ai: i => ai[i], addCourse: event => course.push(event) }, start, stop, destroy, answer, useItem,');
vm.runInNewContext(source, sandbox);
function race(extra = {}) { now = 0; next = null; const events=[]; const r=sandbox.window.GrammarKart.createRace({canvas, lesson:'test', onEvent: e=>events.push(e), ...extra}); r.start(); return {r,events}; }
function tick(seconds) { for (let i=0;i<seconds*10;i++) { now+=100; const cb=next; if (cb) cb(now); } }
{
 const {r,events}=race({laps:3}); assert.equal(r.getState().total,5400); assert(r.getState().standings.some(o=>!o.me && o.distance>0)); tick(5); assert(!events.some(e=>e.kind==='contact')); r.setProgress(1799); tick(1); assert.equal(r.getState().lap,2); assert(r.getState().lapDistance < 100); r.setProgress(5399); tick(1); assert(r.getState().finished); assert.equal(r.getState().distance,5400); r.destroy();
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
 for (let i=0;i<3;i++) { r.fixture.setLane(-.55); r.setProgress(182); tick(.2); const item=r.getState().heldItem; if(item==='missile' || item==='cannon') r.fixture.setOpponent(0,r.getState().distance+60,0); assert(r.useWeapon(item)); }
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
 for (const expected of ['shield','cannon','banana','missile']) { r.fixture.setLane(-.55); r.setProgress(182); tick(.2); assert.equal(r.getState().heldItem,expected); if(expected === 'cannon') r.fixture.setOpponent(0,r.getState().distance+50,0); if(expected !== 'missile') { assert(r.useWeapon(expected)); if(expected === 'cannon') tick(1); } }
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
{
 let count=0; const {r}=race({laps:7,onQuestion:()=>count++}); assert.equal(r.getState().total,12600);
 for(let lap=0;lap<7;lap++) for(const mark of [450,900,1350]) { r.setProgress(lap*1800+mark-1); tick(.2); assert(r.question); r.answer('A'); }
 assert.equal(count,21); r.destroy();
}
{
 const {r,events}=race(); tick(5); r.fixture.setLane(0); r.setProgress(300); tick(1); const before=r.getState(); r.fixture.addCourse({at:before.distance+4,lane:0,kind:'cone'}); tick(.2); const hit=r.getState(); assert(events.some(e=>e.kind==='hit')); assert(hit.slipping); assert(!hit.frozen); assert(hit.distance>before.distance); assert(hit.speed>before.speed*.7); tick(1.3); assert(!r.getState().slipping); assert(r.getState().speed>hit.speed); r.destroy();
}
{
 const {r}=race();
 for(const item of ['banana','missile','ice','shield','cannon']) { r.fixture.setLane(-.55); r.setProgress(182); tick(.2); assert.equal(r.getState().heldItem,item); if(item==='cannon') break; if(item==='missile'||item==='ice') r.fixture.setOpponent(0,r.getState().distance+50,0); assert(r.useWeapon(item)); tick(1); }
 for(let i=0;i<8;i++) r.fixture.setOpponent(i,-1000,0); assert(!r.useWeapon('cannon')); assert.equal(r.getState().cannonStocks,1);
 r.fixture.setOpponent(0,r.getState().distance+50,0); assert(r.useWeapon('cannon')); tick(1); assert(r.fixture.ai(0).skidUntil>0); r.destroy();
}
{
 const {r,events}=race(); tick(5); r.setProgress(300); r.fixture.setLane(0); tick(1); const before=r.getState(); r.fixture.setOpponent(0,before.distance+2,0); tick(.2); const after=r.getState(); assert(events.some(e=>e.kind==='contact')); assert(after.slipping && !after.frozen); assert(after.distance>before.distance && after.speed>before.speed*.7); tick(1.3); assert(!r.getState().slipping); r.destroy();
}
{
 const {r}=race();
 for(const item of ['banana','missile','ice','shield','cannon']) { r.fixture.setLane(-.55); r.setProgress(182); tick(.2); if(item==='cannon') break; if(item==='missile'||item==='ice') r.fixture.setOpponent(0,r.getState().distance+50,0); assert(r.useWeapon(item)); tick(1); }
 r.fixture.ai(0).skidUntil=0; for(let i=1;i<8;i++) r.fixture.setOpponent(i,-1000,0); r.fixture.setOpponent(0,r.getState().distance+50,0); r.fixture.setShield(0,5); assert(r.useWeapon('cannon')); tick(1); assert.equal(r.fixture.ai(0).shieldUntil,0); assert.equal(r.fixture.ai(0).skidUntil,0); r.destroy();
}
{
 const actual={}; vm.runInNewContext(fs.readFileSync('game/questions.js','utf8')+'\nthis.data = GAME_QUESTIONS;',actual); sandbox.GAME_QUESTIONS=actual.data;
 for (const lesson of Object.keys(actual.data).filter(key=>/^g[12]-l[1-8]$/.test(key))) {
   const all=sandbox.window.GrammarKart.getLessonQuestionIds(lesson), seen=new Set(); assert(all.length>=15,lesson);
   for(let round=0;seen.size<all.length && round<10;round++) {
     const old=new Set(seen), questions=[]; const {r}=race({lesson,seenQuestionIds:[...seen],onQuestion: e=>questions.push(e)});
     for(let i=0;i<15;i++) {r.setProgress(Math.floor(i/3)*1800+[450,900,1350][i%3]-1);tick(.2);assert(r.question,`${lesson} ${i}`);r.answer('A');}
     assert.equal(new Set(questions.map(q=>q.question.id)).size,15); assert(questions.every(q=>q.total===15));
     const unseen=all.filter(id=>!old.has(id)).length;
     questions.forEach((q,i)=>{if(i<unseen) assert(!old.has(q.question.id),`${lesson} unseen priority`); seen.add(q.question.id);}); r.destroy();
   }
   assert.equal(seen.size,all.length,`${lesson} coverage`);
 }
}
{
 sandbox.GAME_QUESTIONS={small:{questions:Array.from({length:4},(_,i)=>({id:'s'+i,opts:['A','B','C','D'],ans:'A'}))}};
 const delivered=[];const {r}=race({lesson:'small',onQuestion:e=>delivered.push(e.question.id)});
 for(let i=0;i<15;i++){r.setProgress(Math.floor(i/3)*1800+[450,900,1350][i%3]-1);tick(.2);if(r.question)r.answer('B');}
 assert.equal(delivered.length,4); assert.equal(r.getState().answeredCount,4); assert.equal(r.getState().questionLimit,4); assert.equal(r.getState().lessonQuestionCount,4); r.destroy();
}
{
 sandbox.GAME_QUESTIONS={test:{questions:Array.from({length:40},(_,i)=>({id:'n'+i,opts:['A','B','C','D'],ans:'A'}))}};
 const answered=[];let pending; const first=race({onQuestion:e=>pending=e.question.id,onAnswer:e=>answered.push(e.questionId)}).r; first.setProgress(449);tick(.2);first.answer('B'); first.setProgress(899);tick(.2); const skipped=pending; first.destroy();
 const nextRace=race({seenQuestionIds:answered}).r; let ids=[]; for(let i=0;i<15;i++){nextRace.setProgress(Math.floor(i/3)*1800+[450,900,1350][i%3]-1);tick(.2);ids.push(nextRace.question.id);nextRace.answer('A');} assert(!ids.includes(answered[0])); assert.equal(nextRace.getState().answeredCount,15); nextRace.destroy();
 const skippedRace=race({seenQuestionIds:sandbox.window.GrammarKart.getLessonQuestionIds('test').filter(id=>id!==skipped)}).r; skippedRace.setProgress(449); tick(.2); assert.equal(skippedRace.question.id,skipped,'unanswered question remains priority'); skippedRace.destroy();
 const nine=race({laps:9}).r; assert.equal(nine.getState().total,16200); const nineIds=[];for(let i=0;i<27;i++){nine.setProgress(Math.floor(i/3)*1800+[450,900,1350][i%3]-1);tick(.2);nineIds.push(nine.question.id);nine.answer('A');}assert.equal(new Set(nineIds).size,27);nine.destroy();
}
{
 sandbox.GAME_QUESTIONS={test:{questions:Array.from({length:40},(_,i)=>({id:'rocket'+i,opts:['A','B','C','D'],ans:'A'}))}};
 const {r,events}=race();
 for(let i=0;i<10;i++) {
   r.fixture.setLane(-.55);r.setProgress(182);tick(.2);const item=r.getState().heldItem;assert(item,`box ${i+1}`);
   if(i===9){assert.equal(item,'skyrocket');break;}
   if(item==='missile'||item==='ice'||item==='cannon') r.fixture.setOpponent(0,r.getState().distance+50,0);
   assert(r.useWeapon(item),item);tick(1);
 }
 assert.equal(r.getState().rocketStocks,1);assert(r.useWeapon('skyrocket'));assert(r.getState().flying);assert.equal(r.getState().rocketStocks,0);
 r.fixture.setLane(0);r.setProgress(449);tick(.2);assert(r.question,'question while flying');r.selectGateLane(0); r.fixture.setLane(-.75); r.setProgress(r.fixture.gateAt()-1); tick(.2); assert.equal(r.getState().answeredCount,1,'answer gate during flight');
 r.fixture.clearShield(); r.fixture.setLane(0); const before=r.getState();r.fixture.addCourse({at:before.distance+6,lane:0,kind:'cone'});r.fixture.setOpponent(0,before.distance+3,0);const ev=events.length;tick(1.5);
 assert(r.getState().speed>63*3.6,'rocket faster than boost');assert(!events.slice(ev).some(e=>e.kind==='contact'||e.kind==='hit'),'flying avoids fixed and kart collisions');
 tick(3);assert(!r.getState().flying);assert.equal(r.getState().flightRemaining,0);tick(1);assert(r.getState().speed<63*3.6,'landing returns to normal speed');r.setProgress(1100);r.fixture.setLane(0);const landed=r.getState();r.fixture.addCourse({at:landed.distance+5,lane:0,kind:'cone'});const ev2=events.length;tick(.3);assert(events.slice(ev2).some(e=>e.kind==='hit'),'hazard hits after landing');r.destroy();
}
console.log('kart engine regression: passed');
