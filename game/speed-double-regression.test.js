#!/usr/bin/env node
'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(new URL('index.html',`file://${__dirname}/`),'utf8');
const script=[...html.matchAll(/<script>\s*([\s\S]*?)<\/script>/g)].map(match=>match[1]).find(source=>source.includes('SPEED QUIZ MODE'));
assert(script,'inline game script not found');
new vm.Script(script,{filename:'game/index.html'});

function fn(name){
  const start=script.indexOf(`function ${name}(`);assert.notEqual(start,-1,`${name} missing`);
  const brace=script.indexOf('{',start);let depth=0;
  for(let i=brace;i<script.length;i++){if(script[i]==='{')depth++;if(script[i]==='}'&&--depth===0)return script.slice(start,i+1)}
  throw new Error(`${name} has no closing brace`);
}

const context={classroomMode:false,speedFinished:false,speedLocked:false,speedDoubleCharged:false,speedDoubleArmed:false,speedStreak:0,updateSpeedHUD(){}};
vm.createContext(context);
vm.runInContext([fn('armSpeedDouble'),fn('resetSpeedDouble'),fn('consumeSpeedDouble'),fn('awardSpeedDouble')].join(';'),context);

for(context.speedStreak=1;context.speedStreak<=4;context.speedStreak++)vm.runInContext('awardSpeedDouble()',context);
assert.equal(context.speedDoubleCharged,false,'charge must wait for five consecutive correct answers');
context.speedStreak=5;vm.runInContext('awardSpeedDouble()',context);
assert.equal(context.speedDoubleCharged,true,'fifth consecutive correct answer must store one charge');
context.speedStreak=10;vm.runInContext('awardSpeedDouble()',context);
assert.equal(context.speedDoubleCharged,true,'stored charges must cap at one');

assert.equal(vm.runInContext('armSpeedDouble()',context),true,'stored charge must arm manually');
assert.equal(context.speedDoubleCharged,false);assert.equal(context.speedDoubleArmed,true);
assert.equal(vm.runInContext('armSpeedDouble()',context),false,'repeated clicks must not duplicate an armed power');
let result=vm.runInContext('consumeSpeedDouble(true,160)',context);
assert.deepEqual({...result},{used:true,score:320},'armed correct answer must double its normal score');
assert.equal(context.speedDoubleArmed,false,'submitted answer must consume armed power');

context.speedDoubleCharged=true;vm.runInContext('armSpeedDouble()',context);
result=vm.runInContext('consumeSpeedDouble(false,-20)',context);
assert.deepEqual({...result},{used:true,score:-20},'wrong answer keeps its normal penalty');
assert.equal(context.speedDoubleArmed,false,'wrong answer must also lose the power');

assert.match(fn('startSpeedQuiz'),/resetSpeedDouble\(\)/,'new run must reset both power states');
assert.match(fn('answerSpeedQuiz'),/if \(speedLocked \|\| speedFinished\) return;/,'replayed option click must not resubmit');
assert.match(fn('updateSpeedHUD'),/classroomMode \|\| speedFinished/,'power must be disabled after finish and in classroom mode');
assert.match(html,/@media\(max-width:420px\)[\s\S]*?\.speed-hud \.speed-power\{grid-area:2\/1\/3\/4;width:100%\}/,'390px HUD must give the 44px power button its own full row');
assert.match(html,/\.speed-hud \.speed-power\{min-height:44px/,'power action must meet the minimum touch target');

context.speedDoubleCharged=true;context.speedDoubleArmed=true;
vm.runInContext('resetSpeedDouble()',context);
assert.equal(context.speedDoubleCharged,false);assert.equal(context.speedDoubleArmed,false);
console.log('Speed double chance regression checks passed.');
