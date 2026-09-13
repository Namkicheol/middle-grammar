const EFFECTS = {
  safe_bonus: { notes: [[392, 0, .11], [523, .1, .15], [659, .21, .24]], type: "sine", peak: .055 },
  loot: { notes: [[196, 0, .12], [247, .12, .18]], type: "triangle", peak: .06 },
  share: { notes: [[523, 0, .1], [659, .1, .1], [784, .2, .2]], type: "sine", peak: .05 },
  trap: { notes: [[174, 0, .16], [130, .16, .25]], type: "triangle", peak: .045 },
  double: { notes: [[392, 0, .1], [392, .14, .1], [659, .28, .2]], type: "triangle", peak: .055 },
  triple: { notes: [[392, 0, .09], [523, .11, .09], [659, .22, .09], [988, .34, .22]], type: "sine", peak: .055 },
  donate: { notes: [[330, 0, .12], [440, .13, .12], [554, .26, .2]], type: "sine", peak: .05 },
  gift: { notes: [[523, 0, .1], [659, .11, .12], [880, .24, .22]], type: "sine", peak: .05 },
  angel: { notes: [[440, 0, .12], [659, .13, .14], [988, .28, .25]], type: "sine", peak: .045 },
  global_bomb: { notes: [[110, 0, .22], [82, .18, .34]], type: "triangle", peak: .05 },
  mystery: { notes: [[262, 0, .12], [330, .13, .12], [494, .27, .22]], type: "sine", peak: .045 },
};

const buses = new WeakMap();

function effectBus(context) {
  let bus = buses.get(context);
  if (bus) return bus;
  const gain = context.createGain();
  const limiter = context.createDynamicsCompressor();
  gain.gain.value = .42;
  limiter.threshold.value = -18;
  limiter.knee.value = 12;
  limiter.ratio.value = 5;
  limiter.attack.value = .008;
  limiter.release.value = .16;
  gain.connect(limiter).connect(context.destination);
  bus = { gain, limiter };
  buses.set(context, bus);
  return bus;
}

function soundDefinition(kind) {
  return EFFECTS[String(kind || "")] || EFFECTS.safe_bonus;
}

function scheduleTone(context, output, type, frequency, start, duration, peak) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + .018);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  oscillator.connect(gain).connect(output);
  oscillator.start(start);
  oscillator.stop(start + duration + .025);
}

/**
 * Plays one quiet, procedural treasure outcome through the app's unlocked context.
 * The caller owns the shared mute preference and AudioContext lifecycle.
 */
export async function playTreasureEffect(kind, { unlock, getContext, isMuted } = {}) {
  if (isMuted?.() || !unlock || !getContext) return false;
  if (!(await unlock()) || isMuted?.()) return false;
  const context = getContext();
  if (!context || context.state !== "running") return false;
  const definition = soundDefinition(kind);
  const output = effectBus(context);
  output.gain.gain.setValueAtTime(.42, context.currentTime);
  const now = context.currentTime + .015;
  definition.notes.forEach(([frequency, offset, duration]) => {
    scheduleTone(context, output.gain, definition.type, frequency, now + offset, duration, definition.peak);
  });
  return true;
}

export function muteTreasureEffects(context, muted) {
  if (!context) return;
  const output = buses.get(context);
  if (!output) return;
  const now = context.currentTime;
  output.gain.gain.cancelScheduledValues(now);
  output.gain.gain.setTargetAtTime(muted ? .0001 : .42, now, .018);
}

export const treasureEffectKinds = Object.freeze(Object.keys(EFFECTS));
