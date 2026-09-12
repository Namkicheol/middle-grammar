/*
 * Grammar Escape audio
 *
 * All sounds are synthesized locally.  There are no media files or network
 * requests, which keeps the sound palette deterministic and avoids recording
 * licence concerns for a classroom game.
 */
(() => {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  const STORAGE_KEY = "mg.escape.audioMuted";
  const SOUND_NAMES = new Set(["click", "pickup", "unlock", "wrong", "step", "whisper", "win"]);

  let context = null;
  let master = null;
  let limiter = null;
  let muted = readMuted();
  let unlocked = false;
  let ambientRequested = false;
  let ambient = null;
  const oneShotSources = new Set();

  function readMuted() {
    try {
      return root.localStorage?.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  function writeMuted(value) {
    try {
      root.localStorage?.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      // Private browsing and blocked storage should not disable game audio.
    }
  }

  function audioConstructor() {
    return root.AudioContext || root.webkitAudioContext || null;
  }

  function setAt(param, value, time) {
    if (!param) return;
    try {
      if (typeof param.setValueAtTime === "function") param.setValueAtTime(value, time);
      else param.value = value;
    } catch {
      try { param.value = value; } catch { /* An incomplete test/browser node. */ }
    }
  }

  function cancelAt(param, time) {
    try { param?.cancelScheduledValues?.(time); } catch { /* Best effort. */ }
  }

  function expTo(param, value, time) {
    if (!param) return;
    const safeValue = Math.max(0.0001, value);
    try {
      if (typeof param.exponentialRampToValueAtTime === "function") param.exponentialRampToValueAtTime(safeValue, time);
      else param.value = safeValue;
    } catch {
      try { param.value = safeValue; } catch { /* Best effort. */ }
    }
  }

  function linearTo(param, value, time) {
    if (!param) return;
    try {
      if (typeof param.linearRampToValueAtTime === "function") param.linearRampToValueAtTime(value, time);
      else param.value = value;
    } catch {
      try { param.value = value; } catch { /* Best effort. */ }
    }
  }

  function createAudio() {
    const AudioContext = audioConstructor();
    if (!AudioContext) return false;
    try {
      context = new AudioContext();
      master = context.createGain();
      limiter = context.createDynamicsCompressor();

      // Keep the entire game bus below an intentionally conservative ceiling.
      setAt(master.gain, muted ? 0 : 0.28, context.currentTime);
      setAt(limiter.threshold, -18, context.currentTime);
      setAt(limiter.knee, 16, context.currentTime);
      setAt(limiter.ratio, 8, context.currentTime);
      setAt(limiter.attack, 0.003, context.currentTime);
      setAt(limiter.release, 0.32, context.currentTime);
      master.connect(limiter).connect(context.destination);
      return true;
    } catch {
      context = null;
      master = null;
      limiter = null;
      return false;
    }
  }

  function currentTime() {
    return (context?.currentTime || 0) + 0.012;
  }

  function contextRunning() {
    return Boolean(context && master && context.state === "running");
  }

  function stopSource(source, time = context?.currentTime || 0) {
    try { source?.stop?.(time); } catch { /* Already stopped. */ }
  }

  function disconnect(node) {
    try { node?.disconnect?.(); } catch { /* Already disconnected. */ }
  }

  function trackOneShot(source) {
    oneShotSources.add(source);
    source.onended = () => oneShotSources.delete(source);
    return source;
  }

  function envelope(param, start, attack, peak, release, duration) {
    const attackEnd = start + Math.max(0.002, attack);
    const releaseStart = Math.max(attackEnd, start + duration - release);
    cancelAt(param, start);
    setAt(param, 0.0001, start);
    expTo(param, peak, attackEnd);
    setAt(param, peak, releaseStart);
    expTo(param, 0.0001, start + duration);
  }

  function makeNoiseBuffer(seconds) {
    const length = Math.max(1, Math.ceil(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    // Slightly smoothed noise is less fatiguing than raw white noise.
    let previous = 0;
    for (let index = 0; index < data.length; index += 1) {
      const random = Math.random() * 2 - 1;
      previous = previous * 0.35 + random * 0.65;
      data[index] = previous;
    }
    return buffer;
  }

  function makeOneShot() {
    const output = context.createGain();
    setAt(output.gain, 1, context.currentTime);
    output.connect(master);
    const sources = [];
    const nodes = [output];
    let finished = false;
    return {
      output,
      addSource(source) {
        sources.push(trackOneShot(source));
        nodes.push(source);
        return this;
      },
      addNode(node) {
        nodes.push(node);
        return this;
      },
      finish(stopAt) {
        if (finished) return;
        finished = true;
        sources.forEach((source) => {
          stopSource(source, stopAt);
        });
        const cleanup = () => {
          sources.forEach((source) => oneShotSources.delete(source));
          nodes.forEach(disconnect);
        };
        const timer = root.setTimeout || (typeof setTimeout === "function" ? setTimeout : null);
        if (timer) timer(cleanup, Math.max(0, ((stopAt - (context.currentTime || 0)) * 1000) + 80));
        else cleanup();
      },
    };
  }

  function filterNode(type, frequency, q = 0.7) {
    const filter = context.createBiquadFilter();
    filter.type = type;
    setAt(filter.frequency, frequency, context.currentTime);
    setAt(filter.Q, q, context.currentTime);
    return filter;
  }

  function addTone(voice, {
    start,
    duration,
    frequency,
    endFrequency = frequency,
    peak,
    type = "sine",
    filterType = "lowpass",
    filterFrequency = 1200,
    filterQ = 0.7,
    attack = 0.012,
    release = Math.min(0.16, duration * 0.45),
  }) {
    const oscillator = context.createOscillator();
    oscillator.type = type;
    setAt(oscillator.frequency, frequency, start);
    if (endFrequency !== frequency) expTo(oscillator.frequency, endFrequency, start + duration);
    const filter = filterNode(filterType, filterFrequency, filterQ);
    const gain = context.createGain();
    envelope(gain.gain, start, attack, peak, release, duration);
    oscillator.connect(filter).connect(gain).connect(voice.output);
    voice.addNode(filter).addNode(gain).addSource(oscillator);
    oscillator.start(start);
    stopSource(oscillator, start + duration + 0.025);
  }

  function addNoise(voice, {
    start,
    duration,
    peak,
    type = "bandpass",
    frequency = 1100,
    endFrequency = frequency,
    q = 0.8,
    attack = 0.004,
    release = Math.min(0.14, duration * 0.45),
  }) {
    const source = context.createBufferSource();
    source.buffer = makeNoiseBuffer(Math.max(0.04, duration + 0.03));
    const filter = filterNode(type, frequency, q);
    if (endFrequency !== frequency) {
      setAt(filter.frequency, frequency, start);
      expTo(filter.frequency, endFrequency, start + duration);
    }
    const gain = context.createGain();
    envelope(gain.gain, start, attack, peak, release, duration);
    source.connect(filter).connect(gain).connect(voice.output);
    voice.addNode(filter).addNode(gain).addSource(source);
    source.start(start);
    stopSource(source, start + duration + 0.025);
  }

  function playClick() {
    const voice = makeOneShot();
    const start = currentTime();
    addNoise(voice, { start, duration: 0.028, peak: 0.04, frequency: 1450, endFrequency: 950, q: 1.7, attack: 0.001, release: 0.024 });
    addTone(voice, { start: start + 0.002, duration: 0.082, frequency: 205, endFrequency: 138, peak: 0.052, type: "triangle", filterFrequency: 760, attack: 0.003, release: 0.045 });
    voice.finish(start + 0.13);
  }

  function playPickup() {
    const voice = makeOneShot();
    const start = currentTime();
    // A key ring is a small cluster of soft, inharmonic partials rather than a beep.
    addTone(voice, { start, duration: 0.28, frequency: 520, endFrequency: 880, peak: 0.035, filterType: "bandpass", filterFrequency: 1650, filterQ: 1.1, attack: 0.018, release: 0.13 });
    addTone(voice, { start: start + 0.025, duration: 0.32, frequency: 1040, endFrequency: 1510, peak: 0.022, filterType: "bandpass", filterFrequency: 2650, filterQ: 1.4, attack: 0.012, release: 0.17 });
    addTone(voice, { start: start + 0.055, duration: 0.25, frequency: 1720, endFrequency: 2240, peak: 0.012, filterType: "highpass", filterFrequency: 1200, filterQ: 0.8, attack: 0.008, release: 0.16 });
    addNoise(voice, { start: start + 0.01, duration: 0.06, peak: 0.018, frequency: 2700, endFrequency: 3900, q: 1.5, attack: 0.002, release: 0.05 });
    voice.finish(start + 0.42);
  }

  function playUnlock() {
    const voice = makeOneShot();
    const start = currentTime();
    // Four padded mechanism movements, with a low door frame resonating underneath.
    [0.03, 0.145, 0.26, 0.39].forEach((offset, index) => {
      addNoise(voice, { start: start + offset, duration: 0.062, peak: 0.027 - index * 0.002, frequency: 820 + index * 90, endFrequency: 500 + index * 55, q: 1.15, attack: 0.003, release: 0.05 });
    });
    addTone(voice, { start: start + 0.015, duration: 0.78, frequency: 112, endFrequency: 74, peak: 0.048, type: "triangle", filterFrequency: 430, filterQ: 0.75, attack: 0.035, release: 0.34 });
    addTone(voice, { start: start + 0.17, duration: 0.62, frequency: 238, endFrequency: 166, peak: 0.025, type: "sine", filterFrequency: 820, filterQ: 1.1, attack: 0.018, release: 0.32 });
    addNoise(voice, { start: start + 0.46, duration: 0.28, peak: 0.018, type: "lowpass", frequency: 280, endFrequency: 120, q: 0.8, attack: 0.012, release: 0.2 });
    voice.finish(start + 0.9);
  }

  function playWrong() {
    const voice = makeOneShot();
    const start = currentTime();
    // A soft latch drop: deliberately rounded, low, and free of alarm-like transients.
    addTone(voice, { start, duration: 0.42, frequency: 172, endFrequency: 92, peak: 0.05, type: "triangle", filterFrequency: 500, attack: 0.025, release: 0.22 });
    addTone(voice, { start: start + 0.018, duration: 0.34, frequency: 86, endFrequency: 58, peak: 0.025, type: "sine", filterFrequency: 240, attack: 0.018, release: 0.2 });
    addNoise(voice, { start: start + 0.01, duration: 0.12, peak: 0.016, type: "lowpass", frequency: 420, endFrequency: 170, q: 0.7, attack: 0.008, release: 0.09 });
    voice.finish(start + 0.5);
  }

  function playStep() {
    const voice = makeOneShot();
    const start = currentTime();
    // Two muted shoe/wood impacts produce a quiet footstep without a click spike.
    addNoise(voice, { start, duration: 0.16, peak: 0.036, type: "lowpass", frequency: 360, endFrequency: 120, q: 0.75, attack: 0.008, release: 0.12 });
    addTone(voice, { start: start + 0.004, duration: 0.2, frequency: 78, endFrequency: 48, peak: 0.032, type: "sine", filterFrequency: 250, attack: 0.012, release: 0.14 });
    addNoise(voice, { start: start + 0.14, duration: 0.13, peak: 0.024, type: "lowpass", frequency: 300, endFrequency: 110, q: 0.8, attack: 0.008, release: 0.1 });
    addTone(voice, { start: start + 0.145, duration: 0.16, frequency: 67, endFrequency: 43, peak: 0.021, type: "sine", filterFrequency: 220, attack: 0.012, release: 0.12 });
    voice.finish(start + 0.38);
  }

  function playWhisper() {
    const voice = makeOneShot();
    const start = currentTime();
    // Breath-like filtered noise, never a voiced scream or a sharp alarm.
    addNoise(voice, { start, duration: 0.86, peak: 0.027, type: "bandpass", frequency: 720, endFrequency: 1750, q: 0.65, attack: 0.17, release: 0.31 });
    addNoise(voice, { start: start + 0.19, duration: 0.5, peak: 0.011, type: "highpass", frequency: 2350, endFrequency: 3400, q: 0.55, attack: 0.12, release: 0.25 });
    addTone(voice, { start: start + 0.12, duration: 0.68, frequency: 184, endFrequency: 156, peak: 0.011, type: "sine", filterFrequency: 500, attack: 0.15, release: 0.3 });
    voice.finish(start + 1.1);
  }

  function playWin() {
    const voice = makeOneShot();
    const start = currentTime();
    // A restrained open-chord resolution for the door opening, not a victory jingle.
    [[196, 0], [246.94, 0.06], [293.66, 0.12], [392, 0.42]].forEach(([frequency, offset], index) => {
      addTone(voice, { start: start + offset, duration: 1.08 - index * 0.08, frequency, endFrequency: frequency * 1.008, peak: index === 3 ? 0.022 : 0.027, type: "sine", filterFrequency: 900, attack: 0.16, release: 0.5 });
    });
    addNoise(voice, { start: start + 0.28, duration: 0.72, peak: 0.012, type: "bandpass", frequency: 1180, endFrequency: 2200, q: 0.6, attack: 0.12, release: 0.42 });
    voice.finish(start + 1.65);
  }

  function play(name) {
    if (muted || !contextRunning() || !SOUND_NAMES.has(name)) return false;
    switch (name) {
      case "click": playClick(); break;
      case "pickup": playPickup(); break;
      case "unlock": playUnlock(); break;
      case "wrong": playWrong(); break;
      case "step": playStep(); break;
      case "whisper": playWhisper(); break;
      case "win": playWin(); break;
      default: return false;
    }
    return true;
  }

  function ambientOscillator(nodes, sources, output, {
    start,
    frequency,
    peak,
    type,
    filterFrequency,
    filterQ = 0.7,
    duration = 2.8,
  }) {
    const oscillator = context.createOscillator();
    oscillator.type = type;
    setAt(oscillator.frequency, frequency, start);
    const filter = filterNode("lowpass", filterFrequency, filterQ);
    const gain = context.createGain();
    setAt(gain.gain, 0.0001, start);
    expTo(gain.gain, peak, start + duration);
    oscillator.connect(filter).connect(gain).connect(output);
    oscillator.start(start);
    nodes.push(filter, gain, oscillator);
    sources.push(oscillator);
  }

  function startAmbientGraph() {
    if (ambient || !contextRunning() || muted) return Boolean(ambient);
    const start = currentTime();
    const output = context.createGain();
    setAt(output.gain, 0.7, start);
    output.connect(master);
    const nodes = [output];
    const sources = [];

    // G1 / D2 / G2: a low, open room-tone bed.
    ambientOscillator(nodes, sources, output, { start, frequency: 49, peak: 0.055, type: "sine", filterFrequency: 240 });
    ambientOscillator(nodes, sources, output, { start, frequency: 73.42, peak: 0.022, type: "triangle", filterFrequency: 300 });

    const harmonic = context.createOscillator();
    harmonic.type = "sine";
    setAt(harmonic.frequency, 98, start);
    const harmonicFilter = filterNode("lowpass", 480, 0.75);
    const harmonicGain = context.createGain();
    setAt(harmonicGain.gain, 0.018, start);
    harmonic.connect(harmonicFilter).connect(harmonicGain).connect(output);
    const harmonicLfo = context.createOscillator();
    harmonicLfo.type = "sine";
    setAt(harmonicLfo.frequency, 0.014, start);
    const harmonicDepth = context.createGain();
    setAt(harmonicDepth.gain, 0.012, start);
    harmonicLfo.connect(harmonicDepth).connect(harmonicGain.gain);
    harmonic.start(start);
    harmonicLfo.start(start);
    nodes.push(harmonicFilter, harmonicGain, harmonic, harmonicLfo, harmonicDepth);
    sources.push(harmonic, harmonicLfo);

    // Very slow filter movement gives the drone a changing harmonic colour.
    const filterLfo = context.createOscillator();
    filterLfo.type = "sine";
    setAt(filterLfo.frequency, 0.019, start);
    const filterDepth = context.createGain();
    setAt(filterDepth.gain, 90, start);
    filterLfo.connect(filterDepth).connect(harmonicFilter.frequency);
    filterLfo.start(start);
    nodes.push(filterLfo, filterDepth);
    sources.push(filterLfo);

    // Looping filtered noise supplies an air/rain bed at barely-there levels.
    const air = context.createBufferSource();
    air.buffer = makeNoiseBuffer(2.2);
    air.loop = true;
    const airHigh = filterNode("highpass", 520, 0.55);
    const airLow = filterNode("lowpass", 3000, 0.55);
    const airGain = context.createGain();
    setAt(airGain.gain, 0.009, start);
    air.connect(airHigh).connect(airLow).connect(airGain).connect(output);
    air.start(start);
    nodes.push(airHigh, airLow, airGain, air);
    sources.push(air);

    const rain = context.createBufferSource();
    rain.buffer = makeNoiseBuffer(1.7);
    rain.loop = true;
    const rainHigh = filterNode("highpass", 2600, 0.5);
    const rainBand = filterNode("bandpass", 5100, 0.7);
    const rainGain = context.createGain();
    setAt(rainGain.gain, 0.0032, start);
    rain.connect(rainHigh).connect(rainBand).connect(rainGain).connect(output);
    rain.start(start);
    nodes.push(rainHigh, rainBand, rainGain, rain);
    sources.push(rain);

    const airLfo = context.createOscillator();
    airLfo.type = "sine";
    setAt(airLfo.frequency, 0.031, start);
    const airDepth = context.createGain();
    setAt(airDepth.gain, 0.0032, start);
    airLfo.connect(airDepth).connect(airGain.gain);
    airLfo.start(start);
    nodes.push(airLfo, airDepth);
    sources.push(airLfo);

    ambient = { nodes, sources };
    return true;
  }

  function stopAmbient() {
    ambientRequested = false;
    if (!ambient) return;
    const graph = ambient;
    ambient = null;
    graph.sources.forEach((source) => stopSource(source));
    graph.nodes.forEach(disconnect);
  }

  async function unlock() {
    if (muted) return false;
    if (!context && !createAudio()) return false;
    try {
      if (context.state === "suspended") await context.resume();
      if (context.state !== "running") return false;
      unlocked = true;
      if (ambientRequested) startAmbientGraph();
      return true;
    } catch {
      return false;
    }
  }

  function startAmbient() {
    ambientRequested = true;
    return startAmbientGraph();
  }

  function setMuted(value) {
    muted = Boolean(value);
    writeMuted(muted);
    if (master && context) {
      const time = context.currentTime;
      cancelAt(master.gain, time);
      // The master bus is changed at the current frame, silencing every already
      // scheduled voice immediately without leaving an audible tail.
      setAt(master.gain, muted ? 0 : 0.28, time);
    }
    if (muted) {
      oneShotSources.forEach((source) => stopSource(source));
      oneShotSources.clear();
    } else if (unlocked && ambientRequested) {
      startAmbientGraph();
    }
  }

  function isMuted() {
    return muted;
  }

  function suspendWhenHidden() {
    if (!context || context.state !== "running") return;
    try { context.suspend?.(); } catch { /* Best effort. */ }
  }

  function resumeWhenVisible() {
    if (!unlocked || muted || !context || context.state !== "suspended") return;
    try { context.resume?.().catch?.(() => {}); } catch { /* Best effort. */ }
  }

  if (typeof document !== "undefined" && document.addEventListener) {
    const gestureUnlock = () => { unlock().catch(() => {}); };
    document.addEventListener("pointerdown", gestureUnlock, { capture: true, passive: true });
    document.addEventListener("keydown", gestureUnlock, { capture: true });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") suspendWhenHidden();
      else resumeWhenVisible();
    });
  }
  if (typeof root.addEventListener === "function") root.addEventListener("pagehide", stopAmbient, { once: true });

  root.EscapeAudio = Object.freeze({
    unlock,
    setMuted,
    startAmbient,
    stopAmbient,
    play,
    isMuted,
  });
})();
