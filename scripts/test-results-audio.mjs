import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = (await readFile(new URL("../multiplayer/results.js", import.meta.url), "utf8"))
  .replaceAll("export function ", "function ")
  .replaceAll("export async function ", "async function ")
  + "\nglobalThis.api={initResultPresentation,updateResultPresentation};";

class Store {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

function audioNode(extra = {}) {
  return { connect() { return this; }, disconnect() {}, start() {}, stop() {}, ...extra };
}

class MockAudioContext {
  static instances=[];
  constructor() { this.state="suspended"; this.currentTime=10; this.sampleRate=8000; this.gains=[]; MockAudioContext.instances.push(this); }
  async resume() { this.state="running"; }
  createGain() { const node=audioNode({ gain:{ value:1, setValueAtTime(){}, exponentialRampToValueAtTime(){} } }); this.gains.push(node); return node; }
  createDynamicsCompressor() { return audioNode(); }
  createBiquadFilter() { return audioNode({ frequency:{ value:0, setValueAtTime(){}, exponentialRampToValueAtTime(){} } }); }
  createOscillator() { return audioNode({ frequency:{ value:0 }, detune:{ value:0 }, type:"" }); }
  createBuffer() { return { getChannelData:()=>new Float32Array(8) }; }
  createBufferSource() { return audioNode({ buffer:null }); }
  get destination() { return {}; }
}

function element(attrs = {}) {
  const classes = new Set();
  return {
    dataset:{ ...attrs }, hidden:true, isConnected:true, textContent:"", attributes:{},
    classList:{ add:(name)=>classes.add(name), contains:(name)=>classes.has(name) },
    setAttribute(name,value) { this.attributes[name]=String(value); },
    closest(selector) { return selector === "[data-results-stage]" ? this.stage || null : null; },
  };
}

function harness({ reduced=false, connected=true } = {}) {
  MockAudioContext.instances.length=0;
  const timers=[];
  const events=new Map();
  const buttons=[element({ rank:"3" }),element({ rank:"2" }),element({ rank:"1" })];
  const toggle=element();
  const replay=element();
  const stage=element();
  stage.isConnected=connected;
  replay.stage=stage;
  stage.querySelectorAll=(selector)=>selector === "[data-result-reveal]" ? buttons : selector === "[data-results-sound-toggle]" ? [toggle] : [];
  stage.querySelector=(selector)=>selector === "[data-results-fanfare]" ? replay : null;
  const root={ querySelector:(selector)=>selector === "[data-results-stage]" ? stage : null };
  const document={
    addEventListener(type,callback) { events.set(type,callback); },
    querySelectorAll:(selector)=>selector === "[data-results-sound-toggle]" ? [toggle] : [],
  };
  const localStorage=new Store();
  const sessionStorage=new Store();
  const window={ AudioContext:MockAudioContext, matchMedia:()=>({ matches:reduced }), setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length;} };
  const context=vm.createContext({ window, document, localStorage, sessionStorage, Math, Date, String, Number, Set, Map, Promise, console });
  vm.runInContext(source,context);
  return { ...context.api, window, document, localStorage, sessionStorage, timers, events, buttons, toggle, replay, stage, root };
}

async function runTimers(h, delay) {
  const selected=h.timers.filter((timer)=>timer.delay === delay);
  for (const timer of selected) await timer.fn();
}

// Reveal order and one presentation per rendered room stage.
{
  const h=harness();
  h.initResultPresentation();
  await h.updateResultPresentation(h.root,"room-a");
  assert.deepEqual(h.timers.slice(0,4).map((timer)=>timer.delay),[80,430,800,800]);
  const count=h.timers.length;
  await h.updateResultPresentation(h.root,"room-a");
  assert.equal(h.timers.length,count,"same stage must not schedule twice");
}

// Reduced motion reveals immediately.
{
  const h=harness({ reduced:true });
  await h.updateResultPresentation(h.root,"room-r");
  assert.deepEqual(h.timers.slice(0,4).map((timer)=>timer.delay),[0,0,0,0]);
}

// A newly rendered stage for an already-played room reveals, but never schedules its fanfare again.
{
  const h=harness();
  h.initResultPresentation();
  await h.events.get("pointerdown")();
  await h.updateResultPresentation(h.root,"room-once");
  await runTimers(h,800);
  assert.equal(h.sessionStorage.getItem("mg.multiplayer.resultFanfare:room-once"),"1");
  h.stage.dataset={};
  const before=h.timers.length;
  await h.updateResultPresentation(h.root,"room-once");
  assert.equal(h.timers.length-before,3,"played room should schedule reveals only");
}

// Without an unlocked gesture, automatic audio falls back to a manual replay control.
{
  const h=harness();
  h.initResultPresentation();
  await h.updateResultPresentation(h.root,"room-manual");
  await runTimers(h,800);
  assert.equal(h.replay.hidden,false);
  await h.events.get("click")({ target:{ closest:(selector)=>selector === "[data-results-fanfare]" ? h.replay : null } });
  assert.equal(h.replay.hidden,true);
  assert.equal(h.sessionStorage.getItem("mg.multiplayer.resultFanfare:room-manual"),"1");
}

// Muting immediately silences the active fanfare bus and prevents replay for that stage.
{
  const h=harness();
  h.initResultPresentation();
  await h.events.get("pointerdown")();
  await h.updateResultPresentation(h.root,"room-muted");
  await runTimers(h,800);
  const bus=MockAudioContext.instances[0].gains[0];
  await h.events.get("click")({ target:{ closest:(selector)=>selector === "[data-results-sound-toggle]" ? h.toggle : null } });
  assert.equal(h.localStorage.getItem("mg.multiplayer.resultsMuted"),"1");
  assert.equal(h.toggle.textContent,"소리 꺼짐");
  assert.equal(bus.gain.value,0,"mute must silence an already playing fanfare");
}

// Detached stages never play or reveal a fallback later.
{
  const h=harness({ connected:false });
  h.initResultPresentation();
  await h.events.get("pointerdown")();
  await h.updateResultPresentation(h.root,"room-detached");
  await runTimers(h,800);
  assert.equal(h.sessionStorage.getItem("mg.multiplayer.resultFanfare:room-detached"),null);
}

console.log("results presentation behavior: ok");
