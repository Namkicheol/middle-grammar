#!/usr/bin/env node
'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync(new URL('index.html',`file://${__dirname}/`),'utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
const script=scripts.find(source=>source.includes("'use strict';")&&source.includes('function showStake'));
assert(script,'tower game script not found');
new vm.Script(script,{filename:'tower/index.html'});

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

function fakeClassList(){
  const names=new Set();
  return {add:name=>names.add(name),contains:name=>names.has(name),has:name=>names.has(name),remove:name=>names.delete(name),toggle(){}};
}

{
  const stakeButtons=[
    {disabled:false,dataset:{},classList:fakeClassList()},
    {disabled:false,dataset:{},classList:fakeClassList()}
  ];
  const notices=[];
  const context={
    GS:{over:false,locked:false,event:'bet',betStake:null,items:['fifty'],cur:{ans:'right'},rng:()=>0},
    classroomOn:()=>false,
    document:{querySelectorAll:()=>stakeButtons},
    banner:message=>notices.push(message),
    shuffled:values=>values,
    sfx:{ok(){}},
    renderItems(){}
  };
  vm.createContext(context);
  vm.runInContext(`${functionSource('useItem')};useItem(0)`,context);
  assert.deepEqual([...context.GS.items],['fifty'],'half item must not be consumed before a bet is chosen');
  assert.equal(stakeButtons.some(button=>button.classList.has('dimmed')),false,'bet choices must remain selectable after tapping half');
  assert.match(notices.at(-1)||'',/베팅/,'player must be told to choose the bet first');
}

{
  const timeouts=[];
  let answered=0;
  const fill={classList:fakeClassList(),style:{},offsetWidth:100};
  const context={
    GS:{timerT:null,critT:null,timerEnd:0,timerTotal:0,timerRemaining:0,timerPaused:false},
    $:()=>fill,
    document:{hidden:false},
    classroomOn:()=>false,
    clearTimeout(){},
    setTimeout:(callback,delay)=>{timeouts.push({callback,delay});return timeouts.length;},
    answer:()=>{answered++;},
    expired:0
  };
  vm.createContext(context);
  vm.runInContext(`${functionSource('armTimer')};${functionSource('startTimer')};startTimer(5,()=>{expired++})`,context);
  const deadline=timeouts.find(timer=>timer.delay===5000);
  assert(deadline,'five-second bet deadline must be armed');
  deadline.callback();
  assert.equal(context.expired,1,'bet deadline must run its safe-choice action');
  assert.equal(answered,0,'bet deadline must not submit the grammar question as wrong');
}

console.log('Tower state regression checks passed.');
