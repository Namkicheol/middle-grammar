import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("./audio.js", import.meta.url), "utf8");

class Store {
  #values = new Map();
  getItem(key) { return this.#values.get(key) ?? null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
}

function param(initial = 0) {
  return {
    value: initial,
    setValueAtTime(value) { this.value = value; },
    exponentialRampToValueAtTime(value) { this.value = value; },
    linearRampToValueAtTime(value) { this.value = value; },
    cancelScheduledValues() {},
  };
}

function node(extra = {}) {
  return {
    connect() { return this; },
    disconnect() {},
    start() {},
    stop() {},
    ...extra,
  };
}

class MockAudioContext {
  static instances = [];
  constructor() {
    this.state = "suspended";
    this.currentTime = 10;
    this.sampleRate = 8000;
    this.created = { oscillators: 0, sources: 0, buffers: 0 };
    MockAudioContext.instances.push(this);
  }
  async resume() { this.state = "running"; }
  async suspend() { this.state = "suspended"; }
  createGain() { return node({ gain: param(1) }); }
  createDynamicsCompressor() { return node({ threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }); }
  createBiquadFilter() { return node({ frequency: param(), Q: param() }); }
  createOscillator() { this.created.oscillators += 1; return node({ type: "sine", frequency: param(), detune: param() }); }
  createBufferSource() { this.created.sources += 1; return node({ buffer: null, loop: false }); }
  createBuffer() {
    this.created.buffers += 1;
    return { getChannelData: () => new Float32Array(32) };
  }
  get destination() { return {}; }
}

const events = new Map();
const timers = [];
const document = {
  visibilityState: "visible",
  addEventListener(type, callback) { events.set(type, callback); },
};
const localStorage = new Store();
const window = {
  AudioContext: MockAudioContext,
  localStorage,
  setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; },
  addEventListener() {},
};
const context = vm.createContext({ window, document, localStorage, Math, Promise, Set, Map, globalThis: window });
vm.runInContext(source, context);
const audio = window.EscapeAudio;

assert.deepEqual(Object.keys(audio).sort(), ["isMuted", "play", "setMuted", "startAmbient", "stopAmbient", "unlock"]);
assert.equal(audio.isMuted(), false);

// Starting before the gesture records intent; unlock creates one ambient graph.
assert.equal(audio.startAmbient(), false);
assert.equal(await audio.unlock(), true);
const firstContext = MockAudioContext.instances[0];
const ambientSourceCount = firstContext.created.sources;
assert.ok(ambientSourceCount >= 2, "ambient should contain looping filtered-noise sources");
assert.equal(audio.startAmbient(), true);
assert.equal(firstContext.created.sources, ambientSourceCount, "repeated start must not multiply ambient graphs");

for (const name of ["click", "pickup", "unlock", "wrong", "step", "whisper", "win"]) {
  assert.equal(audio.play(name), true, `${name} should play after unlock`);
}
assert.equal(audio.play("not-a-sound"), false);

audio.setMuted(true);
assert.equal(audio.isMuted(), true);
assert.equal(localStorage.getItem("mg.escape.audioMuted"), "1");
assert.equal(audio.play("step"), false);
audio.setMuted(false);
assert.equal(audio.isMuted(), false);
assert.equal(localStorage.getItem("mg.escape.audioMuted"), "0");
assert.equal(audio.play("step"), true);

// Hidden tabs suspend the context; returning to the tab resumes only after unlock.
document.visibilityState = "hidden";
events.get("visibilitychange")();
assert.equal(firstContext.state, "suspended");
document.visibilityState = "visible";
events.get("visibilitychange")();
await Promise.resolve();
assert.equal(firstContext.state, "running");

audio.stopAmbient();
const sourceCountBeforeRestart = firstContext.created.sources;
assert.equal(audio.startAmbient(), true, "ambient can be restarted after an explicit stop");
assert.equal(firstContext.created.sources, sourceCountBeforeRestart + ambientSourceCount, "one restart should create exactly one new graph");
assert.ok(timers.length > 0, "one-shot voices should clean up after their scheduled end");

console.log("escape audio lifecycle: ok");
