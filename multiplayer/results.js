const MUTE_KEY = "mg.multiplayer.soundMuted";
const LEGACY_MUTE_KEY = "mg.multiplayer.resultsMuted";
const PLAYED_PREFIX = "mg.multiplayer.resultFanfare:";
let audioContext = null;
let gestureReady = false;
let initialized = false;
let fanfareBus = null;
let playingUntil = 0;

function muted() {
  return localStorage.getItem(MUTE_KEY) === "1" || localStorage.getItem(LEGACY_MUTE_KEY) === "1";
}

function roomKey(identity) {
  return `${PLAYED_PREFIX}${String(identity || "unknown").replace(/[^a-z0-9_-]/gi, "").slice(0, 48)}`;
}

function getAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  audioContext ||= new AudioContext();
  return audioContext;
}

async function unlockAudio() {
  const context = getAudioContext();
  if (!context) return false;
  if (context.state === "suspended") await context.resume();
  gestureReady = context.state === "running";
  return gestureReady;
}

async function playFanfare() {
  if (muted()) return false;
  const context = getAudioContext();
  if (!context || context.state !== "running") return false;
  if (context.currentTime < playingUntil) return true;
  const start = context.currentTime + .03;
  playingUntil = start + 2.3;
  fanfareBus = context.createGain();
  fanfareBus.gain.value = .22;
  const limiter = context.createDynamicsCompressor();
  fanfareBus.connect(limiter).connect(context.destination);
  const bus = fanfareBus;
  // Original brass-like "bam, ba-ba, BAAAM" phrase, not a recorded song.
  const brass = (frequency, offset, duration, volume = .5) => {
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2400, start + offset);
    filter.frequency.exponentialRampToValueAtTime(700, start + offset + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(volume, start + offset + .025);
    gain.gain.exponentialRampToValueAtTime(.0001, start + offset + duration);
    filter.connect(gain).connect(bus);
    [-5, 5].forEach((detune) => {
      const voice = context.createOscillator();
      voice.type = "sawtooth";
      voice.frequency.value = frequency;
      voice.detune.value = detune;
      voice.connect(filter);
      voice.start(start + offset);
      voice.stop(start + offset + duration + .02);
    });
  };
  [[392, 0, .26], [523.25, .32, .16], [659.25, .51, .17]].forEach(([f, t, d]) => brass(f, t, d));
  [261.63, 523.25, 659.25, 783.99, 1046.5].forEach((f) => brass(f, .76, 1.38, .28));
  const noise = context.createBuffer(1, Math.ceil(context.sampleRate * .25), context.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  [0, .14, .28, .42, .54, .64, .76].forEach((offset, index) => {
    const hit = context.createBufferSource();
    hit.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1600;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(index === 6 ? .5 : .16 + index * .03, start + offset);
    envelope.gain.exponentialRampToValueAtTime(.0001, start + offset + .17);
    hit.connect(filter).connect(envelope).connect(bus);
    hit.start(start + offset);
  });
  window.setTimeout(() => { bus.disconnect(); limiter.disconnect(); }, 2600);
  return true;
}

function syncSoundControls(root) {
  root.querySelectorAll("[data-results-sound-toggle]").forEach((button) => {
    const isMuted = muted();
    button.setAttribute("aria-pressed", String(isMuted));
    button.textContent = isMuted ? "소리 꺼짐" : "소리 켜짐";
  });
}

export function initResultPresentation() {
  if (initialized) return;
  initialized = true;
  const unlock = () => { unlockAudio().catch(() => {}); };
  document.addEventListener("pointerdown", unlock, { capture: true, passive: true });
  document.addEventListener("keydown", unlock, { capture: true });
  document.addEventListener("click", async (event) => {
    const muteButton = event.target.closest("[data-results-sound-toggle]");
    if (muteButton) {
      const next = muted() ? "0" : "1";
      localStorage.setItem(MUTE_KEY, next);
      localStorage.setItem(LEGACY_MUTE_KEY, next);
      if (muted() && fanfareBus) { fanfareBus.gain.value = 0; playingUntil = 0; }
      syncSoundControls(document);
      return;
    }
    const replay = event.target.closest("[data-results-fanfare]");
    if (replay) {
      await unlockAudio();
      if (await playFanfare()) {
        replay.hidden = true;
        const key = replay.closest("[data-results-stage]")?.dataset.resultStorageKey;
        if (key) sessionStorage.setItem(key, "1");
      }
    }
  });
}

export async function updateResultPresentation(root, roomIdentity) {
  const stage = root?.querySelector?.("[data-results-stage]");
  if (!stage) return;
  if (stage.dataset.presentationStarted === "1") return;
  stage.dataset.presentationStarted = "1";
  syncSoundControls(stage);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  stage.querySelectorAll("[data-result-reveal]").forEach((place) => {
    const rank = Number(place.dataset.rank);
    const delay = reducedMotion ? 0 : ({ 3: 80, 2: 430, 1: 800 }[rank] || 80);
    window.setTimeout(() => place.classList.add("is-revealed"), delay);
  });

  const replay = stage.querySelector("[data-results-fanfare]");
  const key = roomKey(roomIdentity);
  stage.dataset.resultStorageKey = key;
  if (muted() || sessionStorage.getItem(key) === "1") {
    if (replay) replay.hidden = true;
    return;
  }
  if (replay) replay.hidden = true;
  window.setTimeout(async () => {
    if (!stage.isConnected || muted() || sessionStorage.getItem(key) === "1") return;
    const played = gestureReady && await playFanfare();
    if (played) sessionStorage.setItem(key, "1");
    if (replay) replay.hidden = Boolean(played);
  }, reducedMotion ? 0 : 800);
}
