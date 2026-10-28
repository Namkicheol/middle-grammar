const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const sounds = [];
class Audio { constructor(url) { this.url=url; sounds.push(this); } setAttribute() {} play() { this.played=true; return Promise.resolve(); } pause() { this.paused=true; } addEventListener() {} }
const doc = { currentScript:{src:'https://example.test/solo-audio.js'}, hidden:false, addEventListener(){} };
const window = { document:doc, Audio, location:{href:'https://example.test/'}, setTimeout:()=>1, clearTimeout(){} };
vm.runInNewContext(fs.readFileSync('grammar-kart/solo-audio.js','utf8'),{window,URL,Date,Promise});
(async()=>{ const a=window.KartAudio; a.setMuted(true); await a.play('skid'); assert(sounds[0].muted); assert(sounds[0].url.endsWith('kart-tire-squeal-v2.mp3')); a.setMuted(false); assert(!sounds[0].muted); await a.play('cannon'); await a.play('ice'); assert(sounds.some(s=>s.url.endsWith('bomb.mp3'))); assert(sounds.some(s=>s.url.endsWith('shield.mp3'))); a.destroy(); assert(sounds.every(s=>s.paused)); console.log('kart audio playfeel: passed'); })().catch(e=>{console.error(e);process.exitCode=1});
