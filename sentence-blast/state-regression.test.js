#!/usr/bin/env node
'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(new URL('index.html',`file://${__dirname}/`),'utf8');
const script=html.match(/<script>\s*('use strict';[\s\S]*?)<\/script>/)?.[1];
assert(script,'inline game script not found');
new vm.Script(script,{filename:'sentence-blast/index.html'});
assert.match(script,/validUnitLaunch=requestedUnitKey==='all'\|\|Boolean\(requestedUnitKey&&GAME_QUESTIONS\[requestedUnitKey\]&&!GAME_QUESTIONS\[requestedUnitKey\]\.hidden\)/,'solo launch must accept only visible units or all');
assert.match(script,/location\.replace\('\.\.\/game\/\?mode=sentence'\)/,'invalid solo launch must return to sentence mode picker');
assert.match(script,/requestedSeconds=params\.get\('seconds'\)/,'sentence launch must read the shared seconds query');
assert.match(script,/requestedSeconds==='0'\?0/,'seconds=0 must remain unlimited');
assert.match(script,/duration===0&&!classroomMode\?'∞':time/,'unlimited solo sentence blast must show an unlimited timer');

function functionSource(name){
  const start=script.indexOf(`function ${name}(`);
  assert.notEqual(start,-1,`${name} not found`);
  const brace=script.indexOf('{',start);
  let depth=0;
  for(let i=brace;i<script.length;i++){
    if(script[i]==='{')depth++;
    if(script[i]==='}'&&--depth===0)return script.slice(start,i+1);
  }
  throw new Error(`${name} has no closing brace`);
}

const elements={
  chips:{children:['old chip'],replaceChildren(){this.children=[]}},
  'answer-zone':{children:['old answer'],replaceChildren(){this.children=[]}},
  feedback:{textContent:'old feedback',className:'feedback ng'}
};
const context={chosen:[{old:true}],currentQuestion:{id:'old'},currentSentence:'old words',$:id=>elements[id]};
vm.createContext(context);
vm.runInContext(`${functionSource('clearChallengeState')};clearChallengeState()`,context);
assert.equal(context.chosen.length,0,'chosen tokens must be discarded');
assert.equal(context.currentQuestion,null,'old question must be discarded');
assert.equal(context.currentSentence,'','old sentence must be discarded');
assert.deepEqual(elements.chips.children,[],'old source chips must be removed');
assert.deepEqual(elements['answer-zone'].children,[],'old arranged words must be removed');
assert.equal(elements.feedback.textContent,'','old feedback must be removed');

const removedListeners=[];
let ghostRemoved=false,previewCleared=false;
const dragContext={
  dragState:{ghost:{remove(){ghostRemoved=true}}},moveDrag(){},endDrag(){},
  clearPreview(){previewCleared=true},
  document:{removeEventListener(type,handler){removedListeners.push([type,handler])}}
};
vm.createContext(dragContext);
vm.runInContext(`${functionSource('cancelDrag')};cancelDrag()`,dragContext);
assert.equal(dragContext.dragState,null,'cancelled drag state must be discarded');
assert.equal(ghostRemoved,true,'cancelled drag ghost must be removed');
assert.equal(previewCleared,true,'cancelled drag preview must be cleared');
assert.deepEqual(removedListeners.map(([type])=>type),['pointermove','pointerup','pointercancel'],'all drag listeners must be removed');

for(const name of ['openChallenge','closeChallenge','finish']){
  assert.match(functionSource(name),/clearChallengeState\(\)/,`${name} must clear challenge state`);
}
for(const name of ['openChallenge','finish'])assert.match(functionSource(name),/cancelDrag\(\)/,`${name} must cancel an active drag`);
assert.match(functionSource('endDrag'),/e\.type==='pointercancel'\|\|phase!=='play'/,'pointer cancellation must never place a block');
assert.doesNotMatch(functionSource('openChallenge'),/catch\(e\)\{[^}]*phase='play'/, 'question retry must not let the main tick start parallel requests');
assert.match(functionSource('resolveChallenge'),/runId!==challengeRunId/, 'late answer results must be ignored');
assert.match(functionSource('resolveChallenge'),/setTimeout\(\(\)=>\{if\(runId!==challengeRunId/, 'late success timer must be ignored');
assert.equal((functionSource('closeChallenge').match(/resumePlayClocks\(\)/g)||[]).length,1,'closing a challenge must resume the play clock exactly once');

async function testLateRejection(){
  let rejectAnswer;
  const buttons={'check-btn':{disabled:false},'reset-btn':{disabled:false},feedback:{}};
  const lateContext={
    locked:false,challengeRunId:7,classroomMode:true,currentQuestion:{id:'old'},classroomFinished:false,phase:'challenge',
    ClassroomMatch:{answer(){return new Promise((_,reject)=>{rejectAnswer=reject})},isActive(){return true}},
    $:id=>buttons[id],toast(){throw new Error('stale rejection must not show feedback')}
  };
  vm.createContext(lateContext);
  const asyncResolve=functionSource('resolveChallenge').replace('function resolveChallenge','async function resolveChallenge');
  vm.runInContext(`${asyncResolve};pending=resolveChallenge(false,false,'old answer')`,lateContext);
  await Promise.resolve();
  lateContext.challengeRunId=8;
  rejectAnswer(new Error('late network failure'));
  await lateContext.pending;
  assert.equal(lateContext.locked,true,'late rejection must not unlock the newer challenge');
  assert.equal(buttons['check-btn'].disabled,true,'late rejection must not enable the newer check button');
  assert.equal(buttons['reset-btn'].disabled,true,'late rejection must not enable the newer reset button');
}

function testUnlimitedClockAndChallengeCadence(){
  let opened=0, resolved=false, critState=null;
  const elements={
    score:{textContent:''},lines:{textContent:''},combo:{textContent:''},grammar:{textContent:''},
    'rescue-left':{textContent:''},time:{textContent:'',classList:{toggle(name,value){if(name==='crit')critState=value;}}},
    'phase-fill':{style:{}},'phase-label':{textContent:''},'challenge-time':{textContent:''}
  };
  let now=100;
  const context={
    duration:0,classroomMode:false,remaining:Infinity,remainingMs:Infinity,phase:'play',phaseRemaining:0,
    phaseRemainingMs:0,playDeadline:Infinity,phaseDeadline:0,challengeDeadline:0,
    PLAY_PHASE_SECONDS:15,
    score:0,lines:0,combo:0,grammarCorrect:0,grammarTotal:0,rescuesRemaining:2,lastHUDState:'',
    challengeLeft:10,lastChallengeTime:-1,locked:false,performance:{now:()=>now},$:id=>elements[id],
    openChallenge(){opened++;context.phase='challenge';},finish(){throw new Error('unlimited clock must not finish');},
    resolveChallenge(_correct,timedOut){resolved=timedOut;}
  };
  vm.createContext(context);
  vm.runInContext([
    functionSource('formatTime'),functionSource('reconcilePlayClock'),
    functionSource('updateHUD'),functionSource('tick')
  ].join('\n'),context);

  context.tick();
  assert.equal(opened,1,'seconds=0 must keep the play clock alive and reach the challenge cadence');
  assert.equal(elements.time.textContent,'∞','solo seconds=0 HUD must show the unlimited marker');

  now=500;
  context.challengeDeadline=1000;
  context.tick();
  assert.equal(context.challengeLeft,1,'challenge countdown must continue during an unlimited run');
  assert.equal(resolved,false,'challenge must remain active before its deadline');
  now=1200;
  context.tick();
  assert.equal(resolved,true,'challenge timeout must still resolve during an unlimited run');

  context.classroomMode=true;
  context.phase='play';
  context.remaining=42;
  context.lastHUDState='';
  context.updateHUD();
  assert.equal(elements.time.textContent,'0:42','classroom HUD must use its finite server clock');
  assert.notEqual(elements.time.textContent,'∞','classroom HUD must never show the solo unlimited marker');
  context.remaining=12;
  context.lastHUDState='';
  context.updateHUD();
  assert.equal(critState,true,'classroom finite low-time HUD must retain its warning state');
}

testLateRejection().then(()=>{
  testUnlimitedClockAndChallengeCadence();
  console.log('Sentence Blast state regression checks passed.');
});
