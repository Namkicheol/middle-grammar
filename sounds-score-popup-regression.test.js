#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(new URL('sounds.js', `file://${__dirname}/`), 'utf8');

function makeContext() {
  const timers = [];
  const popupCalls = [];
  const roundedInputs = [];
  let toneCount = 0;

  function FakeAudioContext() {
    this.state = 'running';
    this.currentTime = 0;
    this.destination = {};
  }
  FakeAudioContext.prototype.resume = function () { return Promise.resolve(); };
  FakeAudioContext.prototype.createOscillator = function () {
    toneCount++;
    return {
      connect() {},
      frequency: { setValueAtTime() {} },
      type: '',
      start() {},
      stop() {}
    };
  };
  FakeAudioContext.prototype.createGain = function () {
    return {
      connect() {},
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }
    };
  };

  const document = {
    addEventListener() {},
    getElementById() { return null; }
  };
  const context = {
    document,
    MutationObserver: function () {
      this.observe = function () {};
      this.disconnect = function () {};
    },
    setTimeout(fn) { timers.push(fn); return timers.length; },
    Date: { now: () => 2000 },
    console,
    AudioContext: FakeAudioContext
  };
  context.window = context;
  context.window.showScorePopup = function (correct, total) { popupCalls.push({ correct, total }); };
  context.window.addEventListener = function () {};
  context.Math = Object.create(Math);
  context.Math.round = function (value) {
    roundedInputs.push(value);
    return Math.round(value);
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'sounds.js' });
  return {
    context,
    timers,
    popupCalls,
    roundedInputs,
    get toneCount() { return toneCount; }
  };
}

const cases = [
  { correct: 0, total: 0, score: 0, tones: 2, rounded: [] },
  { correct: 0, total: 10, score: 0, tones: 2, rounded: [0] },
  { correct: 5, total: 10, score: 50, tones: 3, rounded: [50] },
  { correct: 10, total: 10, score: 100, tones: 4, rounded: [100] }
];

for (const testCase of cases) {
  const fixture = makeContext();
  fixture.context.showScorePopup(testCase.correct, testCase.total);
  assert.deepEqual(fixture.popupCalls, [{ correct: testCase.correct, total: testCase.total }]);
  assert.equal(fixture.timers.length, 1, `${testCase.correct}/${testCase.total} should schedule one result sound`);
  fixture.timers.shift()();
  assert.deepEqual(fixture.roundedInputs, testCase.rounded, `${testCase.correct}/${testCase.total} must not round NaN`);
  assert.equal(fixture.toneCount, testCase.tones, `${testCase.correct}/${testCase.total} should use its finite score band`);
}

console.log('Sounds score-popup boundary regression checks passed.');
