import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const home = read('game/index.html');
const boss = read('game2/index.html');
const tower = read('tower/index.html');
const rangers = read('grammar-rangers/index.html');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(home.includes("function soloLaunchQuery(unitKey)"), 'home must own the solo launch contract');
assert(home.includes("query.set('autostart', '1')") && home.includes("query.set('unit', unitKey || 'all')") && home.includes("query.set('seconds', String(seconds))"), 'home must pass autostart, unit, and seconds');
assert(home.includes("const requestedMode = new URLSearchParams(location.search).get('mode')") && home.includes('requestedModeButton.click()'), 'hub mode deep-links must select the requested mode');

assert(boss.includes('function redirectToHub()') && boss.includes("hub.searchParams.set('mode', 'boss')"), 'boss invalid URLs must return to the boss hub mode');
assert(boss.includes('const visibleUnit = unit && unit !== \'all\' && GAME_QUESTIONS[unit] && !GAME_QUESTIONS[unit].hidden'), 'boss must reject hidden legacy units');
assert(boss.includes('#boss-start{position:fixed') && boss.includes('display:none'), 'boss start gate must be hidden in the initial CSS state');
assert(boss.includes('if (!classroomOn()) startPendingBattle();'), 'boss solo launches must skip the start gate');
assert(boss.includes('classroom.ready.then(()=>{if(!classroomFinished&&_pendingBattle)startPendingBattle();})'), 'boss classroom launch must wait for ready');
assert(!boss.includes('showInvalidBattleStart'), 'boss must not retain a duplicate invalid-unit gate');

for (const [name, source, mode, starter] of [
  ['tower', tower, 'tower', 'startRun(gateMode)'],
  ['rangers', rangers, 'rangers', 'requestRun(gateScope)'],
]) {
  assert(source.includes('html[data-solo-launch] #gate{display:none!important}'), `${name} must hide its gate before direct launch state runs`);
  assert(source.includes("document.documentElement.dataset.soloLaunch = '1';"), `${name} must mark its initial loading state`);
  assert(source.includes('const validUnitParam=rawUnitParam===\'all\'||Boolean(visibleUnitParam);'), `${name} must accept all or visible units only`);
  assert(source.includes(`hub.searchParams.set('mode','${mode}');`), `${name} invalid URLs must return to the matching hub mode`);
  assert(source.includes(`if(!classroomOn()&&!validUnitParam){redirectToHub();}`), `${name} must redirect missing/invalid solo URLs`);
  assert(source.includes(`if(!classroomOn()&&validUnitParam){`) && source.includes(starter), `${name} must immediately start valid solo URLs`);
  assert(source.includes('classroom.ready.then('), `${name} classroom launch must wait for ready`);
  const soloStart = source.indexOf('if(!classroomOn()&&validUnitParam){');
  assert(soloStart >= 0 && source.slice(soloStart, soloStart + 140).includes('!classroomOn()'), `${name} solo start must remain behind the classroom-off guard`);
  assert(source.includes('document.documentElement.removeAttribute(\'data-solo-launch\')'), `${name} classroom errors must restore its status gate`);
}

console.log('PASS: solo launcher contract, visible-unit guards, and classroom boundaries');
