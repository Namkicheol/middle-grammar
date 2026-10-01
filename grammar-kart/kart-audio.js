(function (root) {
  'use strict';

  const doc = root.document;
  const scriptUrl = doc?.currentScript?.src || root.location?.href || '';
  let audioBase = './assets/audio/';
  try { audioBase = new URL('./assets/audio/', scriptUrl).href; } catch (_) {}

  const AudioCtor = root.Audio;
  const state = {
    context: null,
    destroyed: false,
    muted: false,
    music: null,
    engine: null,
    musicStarted: false,
    active: new Set(),
    timers: new Set(),
    lastPlayed: new Map()
  };

  const CUES = Object.freeze({
    countdown: { file: 'select.ogg', volume: 0.28, rate: 0.82, stopAfter: 230, cooldown: 130 },
    go: { file: 'reveal.ogg', volume: 0.40, rate: 1.08, stopAfter: 620, cooldown: 240 },
    boost: { file: 'missile-whoosh.ogg', volume: 0.32, rate: 0.8, stopAfter: 900, cooldown: 180 },
    item: { file: 'shield.ogg', volume: 0.34, rate: 0.90, stopAfter: 760, cooldown: 200 },
    missile: { file: 'missile-whoosh.ogg', volume: 0.38, rate: 1, stopAfter: 720, cooldown: 350 },
    hit: { file: 'kart-impact.ogg', volume: 0.4, rate: 1, stopAfter: 540, cooldown: 300 },
    skid: { file: 'kart-skid.ogg', volume: 0.27, rate: 1, stopAfter: 650, cooldown: 900 },
    correct: { file: 'select.ogg', volume: 0.22, rate: 1.12, stopAfter: 200, cooldown: 180 },
    wrong: { file: 'bomb.ogg', volume: 0.15, rate: 0.58, stopAfter: 680, cooldown: 220 },
    finish: { file: 'angel.ogg', volume: 0.48, rate: 1.00, stopAfter: 2650, cooldown: 900 }
  });

  function fileUrl(file) {
    try { return new URL(file, audioBase).href; } catch (_) { return `${audioBase}${file}`; }
  }

  function ensureContext() {
    if (state.context || state.destroyed) {
      if (state.destroyed) state.destroyed = false;
      else return state.context;
    }
    const Context = root.AudioContext || root.webkitAudioContext;
    if (!Context) return null;
    try { state.context = new Context(); } catch (_) { state.context = null; }
    return state.context;
  }

  function unlock() {
    const context = ensureContext();
    if (!context) return false;
    try {
      const result = context.resume?.();
      if (result?.catch) result.catch(() => {});
    } catch (_) {}
    return true;
  }

  function makeAudio(file, loop) {
    if (!AudioCtor) return null;
    try {
      const audio = new AudioCtor(fileUrl(file));
      audio.preload = 'auto';
      audio.loop = !!loop;
      audio.setAttribute?.('aria-hidden', 'true');
      return audio;
    } catch (_) { return null; }
  }

  function setElementMute(audio) {
    if (!audio) return;
    audio.muted = state.muted;
  }

  function startElement(audio, volume, reset) {
    if (!audio) return false;
    try {
      if (reset) audio.currentTime = 0;
      audio.volume = state.muted ? 0 : volume;
      setElementMute(audio);
      const result = audio.play();
      if (result?.catch) result.catch(() => {});
      return true;
    } catch (_) { return false; }
  }

  function startMusic() {
    if (state.musicStarted) return true;
    unlock();
    if (!state.music) state.music = makeAudio('race-v2.mp3', true);
    if (!state.engine) state.engine = makeAudio('kart-engine.ogg', true);
    if (!state.music && !state.engine) return false;
    state.musicStarted = true;
    if (!doc?.hidden) {
      startElement(state.music, 0.28, true);
      startElement(state.engine, 0.15, true);
    }
    return true;
  }

  function stopElement(audio) {
    if (!audio) return;
    try { audio.pause(); audio.currentTime = 0; } catch (_) {}
  }

  function stopMusic() {
    state.musicStarted = false;
    stopElement(state.music);
    stopElement(state.engine);
  }

  function setMuted(muted) {
    state.muted = !!muted;
    setElementMute(state.music);
    setElementMute(state.engine);
    for (const audio of state.active) setElementMute(audio);
  }

  function setEngineSpeed(speed, boosted) {
    if (!state.engine) return;
    state.engine.playbackRate = Math.max(0.78, Math.min(1.55, 0.78 + (Number(speed) || 0) / 190 + (boosted ? 0.18 : 0)));
  }

  function scheduleCleanup(audio, delay) {
    if (!delay || !root.setTimeout) return;
    const timer = root.setTimeout(() => {
      state.timers.delete(timer);
      try { audio.pause(); audio.currentTime = 0; } catch (_) {}
      state.active.delete(audio);
    }, delay);
    state.timers.add(timer);
  }

  function playFile(cue) {
    const audio = makeAudio(cue.file, false);
    if (!audio) return false;
    if (state.active.size >= 3) {
      const oldest = state.active.values().next().value;
      stopElement(oldest); state.active.delete(oldest);
    }
    audio.volume = state.muted ? 0 : cue.volume;
    audio.playbackRate = cue.rate;
    setElementMute(audio);
    state.active.add(audio);
    const cleanup = () => state.active.delete(audio);
    audio.addEventListener?.('ended', cleanup, { once: true });
    try {
      const result = audio.play();
      if (result?.catch) result.catch(cleanup);
    } catch (_) { cleanup(); return false; }
    scheduleCleanup(audio, cue.stopAfter);
    return true;
  }

  function tone(context, frequency, at, duration, type, volume, endFrequency) {
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, at);
      if (endFrequency && oscillator.frequency.linearRampToValueAtTime) oscillator.frequency.linearRampToValueAtTime(endFrequency, at + duration);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + duration + 0.04);
      oscillator.addEventListener?.('ended', () => { oscillator.disconnect?.(); gain.disconnect?.(); }, { once: true });
    } catch (_) {}
  }

  function playSynth(name) {
    if (state.muted) return;
    const context = ensureContext();
    if (!context) return;
    const now = context.currentTime;
    if (name === 'countdown') tone(context, 392, now, 0.13, 'triangle', 0.045);
    if (name === 'go') {
      tone(context, 523, now, 0.16, 'triangle', 0.055);
      tone(context, 659, now + 0.08, 0.22, 'triangle', 0.05);
      tone(context, 784, now + 0.16, 0.28, 'sine', 0.04);
    }
    if (name === 'boost') tone(context, 180, now, 0.32, 'sawtooth', 0.045, 700);
    if (name === 'item') {
      tone(context, 660, now, 0.10, 'sine', 0.04);
      tone(context, 880, now + 0.08, 0.14, 'sine', 0.035);
    }
    if (name === 'hit') tone(context, 130, now, 0.20, 'sawtooth', 0.05, 58);
    if (name === 'missile') tone(context, 330, now, 0.26, 'sawtooth', 0.04, 850);
    if (name === 'correct') {
      tone(context, 659, now, 0.13, 'sine', 0.04);
      tone(context, 831, now + 0.09, 0.19, 'sine', 0.04);
    }
    if (name === 'wrong') {
      tone(context, 220, now, 0.16, 'triangle', 0.035);
      tone(context, 165, now + 0.10, 0.22, 'triangle', 0.03);
    }
    if (name === 'finish') {
      [523, 659, 784, 1047].forEach((frequency, index) => tone(context, frequency, now + index * 0.10, 0.34, 'sine', 0.045));
    }
  }

  function play(name) {
    const cue = CUES[name];
    if (!cue || state.destroyed || doc?.hidden) return false;
    const now = Date.now();
    const previous = state.lastPlayed.get(name) || 0;
    if (now - previous < cue.cooldown) return false;
    state.lastPlayed.set(name, now);
    const played = playFile(cue);
    if (!played) playSynth(name);
    return played;
  }

  function destroy() {
    stopMusic();
    for (const timer of state.timers) root.clearTimeout?.(timer);
    state.timers.clear();
    for (const audio of state.active) stopElement(audio);
    state.active.clear();
    const context = state.context;
    state.context = null;
    state.destroyed = true;
    try {
      const result = context?.close?.();
      if (result?.catch) result.catch(() => {});
    } catch (_) {}
  }

  doc?.addEventListener('visibilitychange', () => {
    if (doc.hidden) {
      try { state.music?.pause(); state.engine?.pause(); } catch (_) {}
      for (const audio of state.active) stopElement(audio);
      state.active.clear();
    } else if (state.musicStarted && !state.destroyed) {
      startElement(state.music, 0.28, false);
      startElement(state.engine, 0.15, false);
    }
  });

  root.KartAudio = Object.freeze({ unlock, startMusic, stopMusic, setMuted, setEngineSpeed, play, destroy });
})(window);
