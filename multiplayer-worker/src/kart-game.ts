// Server-owned race physics. Clients send steering intent only, never distance or rewards.
export const KART_DISTANCE = 1800;
export const KART_DESIGNS = ["teal", "red", "yellow"] as const;
export const KART_COLORS = ["cyan", "coral", "gold", "violet", "lime", "pink"] as const;
export type KartEvent = "hit" | "pad" | "star" | "box" | "banana";
export type KartWeapon = "banana" | "missile" | "shield";
export const KART_QUESTION_MARKS = [450, 900, 1350];
export type KartCue = { kind: "reward_boost" | "reward_missile" | "reward_shield" | "boost" | "missile" | "missile_hit" | "shield_block" | "banana_hit" | "contact"; at: number; from?: string; target?: string };
export interface KartState {
  design: string;
  color: string;
  lane: number;
  distance: number;
  speed: number;
  updatedAt: number;
  boostUntil: number;
  slowUntil: number;
  shieldUntil: number;
  hitUntil: number;
  charge: number;
  boostStock: number;
  missiles: number;
  shields: number;
  rewardsGiven: number;
  checkpointsAt: number[];
  lastCue?: KartCue;
  heldItem?: KartWeapon;
  boxes: number;
  banana?: { at: number; lane: number; until: number };
  slipUntil: number;
  driftMs: number;
  draftMs: number;
  draftUntil: number;
  itemReadyAt: number;
  nextEvent: number;
  seq: number;
  finishedAt?: number;
  hits: number;
  pads: number;
  stars: number;
}

const BASE_KART_COURSE: { at: number; lane: number; kind: KartEvent }[] = Array.from({ length: 13 }, (_, i): { at: number; lane: number; kind: KartEvent }[] => {
  const base = 115 + i * 125;
  const obstacle = [-.55, 0, .55, 0, .55, -.55][i % 6];
  const pad = obstacle === 0 ? (i % 2 ? -.55 : .55) : 0;
  return [
    { at: base, lane: obstacle, kind: "hit" },
    { at: base + 20, lane: pad, kind: "pad" },
    { at: base + 43, lane: -pad || -.55, kind: "star" },
    { at: base + 68, lane: i % 2 ? .55 : -.55, kind: "box" },
    ...(i % 2 === 0 ? [{ at: base + 96, lane: i % 4 ? -.55 : .55, kind: "banana" as const }] : []),
  ];
}).flat().filter(event => !(["hit", "banana"].includes(event.kind) && KART_QUESTION_MARKS.some(mark => event.at >= mark - 20 && event.at <= mark + 335)));

const coinChains = [
  { base: 270, lane: -.55 },
  { base: 810, lane: .55 },
  { base: 1260, lane: 0 },
];
const EXTRA_KART_COURSE: { at: number; lane: number; kind: KartEvent }[] = [
  ...coinChains.flatMap(({ base, lane }) => Array.from({ length: 3 }, (_, j) => ({ at: base + j * 12, lane, kind: "star" as const }))),
  { at: 1250, lane: -.55, kind: "hit" },
  { at: 1270, lane: .55, kind: "pad" },
];
export const KART_COURSE: { at: number; lane: number; kind: KartEvent }[] = [...BASE_KART_COURSE, ...EXTRA_KART_COURSE]
  .sort((a, b) => a.at - b.at);

const limit = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

export function createKart(now: number, design = "teal", color = "cyan"): KartState {
  return { design, color, lane: 0, distance: 0, speed: 0, updatedAt: now, boostUntil: 0, slowUntil: 0,
    shieldUntil: 0, hitUntil: 0, charge: 0, boostStock: 0, missiles: 0, shields: 0, rewardsGiven: 0, checkpointsAt: [],
    boxes: 0, slipUntil: 0, driftMs: 0, draftMs: 0, draftUntil: 0,
    itemReadyAt: 0, nextEvent: 0, seq: 0, hits: 0, pads: 0, stars: 0 };
}

export function advanceKart(source: KartState, now: number): KartState {
  const kart = { ...source,
    boostStock: source.boostStock ?? 0, missiles: source.missiles ?? 0, shields: source.shields ?? 0,
    rewardsGiven: source.rewardsGiven ?? 0, checkpointsAt: source.checkpointsAt ?? [],
    slipUntil: source.slipUntil ?? 0, driftMs: source.driftMs ?? 0, draftMs: source.draftMs ?? 0,
    draftUntil: source.draftUntil ?? 0 };
  if (source.finishedAt || now <= source.updatedAt) return kart;
  let at = source.updatedAt;
  while (at < now && !kart.finishedAt) {
    const step = Math.min(100, now - at);
    at += step;
    const target = at < kart.slowUntil ? 14 : at < kart.boostUntil ? 46 : at < kart.draftUntil ? 34 : 31;
    kart.speed += (target - kart.speed) * Math.min(1, step / 1000 * 2.3);
    const before = kart.distance;
    kart.distance = Math.min(KART_DISTANCE, kart.distance + kart.speed *
      (Math.abs(kart.lane) > .79 && at >= kart.shieldUntil ? .66 : 1) * step / 1000);
    while (kart.checkpointsAt.length < KART_QUESTION_MARKS.length &&
      before < KART_QUESTION_MARKS[kart.checkpointsAt.length] && kart.distance >= KART_QUESTION_MARKS[kart.checkpointsAt.length]) {
      kart.checkpointsAt = [...kart.checkpointsAt, at];
    }
    while (kart.nextEvent < KART_COURSE.length && KART_COURSE[kart.nextEvent].at <= kart.distance) {
      const event = KART_COURSE[kart.nextEvent++];
      if (event.at <= before || Math.abs(kart.lane - event.lane) > (event.kind === "box" ? .36 : .28)) continue;
      if ((event.kind === "hit" || event.kind === "banana") && at >= kart.hitUntil && at >= kart.shieldUntil) {
        kart.hits++; kart.hitUntil = at + 1400; kart.slowUntil = Math.max(kart.slowUntil, at + 2100);
        if (event.kind === "banana") { kart.slipUntil = at + 1700; kart.lastCue = { kind: "banana_hit", at }; }
      } else if (event.kind === "pad") {
        kart.pads++; kart.boostUntil = Math.max(kart.boostUntil, at) + 1600;
      } else if (event.kind === "star") {
        kart.stars++; kart.charge = Math.min(3, kart.charge + 1);
      } else if (event.kind === "box" && !kart.heldItem) {
        kart.heldItem = "banana"; kart.boxes++;
      }
    }
    if (kart.distance >= KART_DISTANCE) kart.finishedAt = at;
  }
  kart.updatedAt = now;
  return kart;
}

export function steerKart(source: KartState, lane: number, seq: number, now: number): KartState {
  if (!Number.isInteger(seq) || seq !== source.seq + 1 || !Number.isFinite(lane) || Math.abs(lane) > .88) {
    throw new Error("INVALID_KART_MOVE");
  }
  const elapsed = Math.max(0, now - source.updatedAt);
  // The bound includes one packet of network/jitter tolerance. A forged teleport still fails.
  if (Math.abs(lane - source.lane) > 1.28 * elapsed / 1000 + .16) throw new Error("INVALID_KART_MOVE");
  let kart = { ...source };
  if (elapsed > 0) {
    while (kart.updatedAt < now && !kart.finishedAt) {
      const nextAt = Math.min(now, kart.updatedAt + 100);
      const fraction = (nextAt - source.updatedAt) / elapsed;
      kart = advanceKart({ ...kart, lane: limit(source.lane + (lane - source.lane) * fraction, -.88, .88) }, nextAt);
    }
  }
  kart.lane = limit(lane + (now < kart.slipUntil ? Math.sin(now / 115) * .07 : 0), -.88, .88);
  if (kart.speed > 14 && Math.abs(lane - source.lane) > .03) {
    kart.driftMs = (source.driftMs ?? 0) + Math.min(elapsed, 700);
    kart.charge = Math.min(3, kart.charge + Math.abs(lane - source.lane) * .45 + (kart.driftMs > 450 ? elapsed / 1000 * .22 : 0));
  } else kart.driftMs = 0;
  kart.seq = seq;
  return kart;
}

export function rewardKart(source: KartState, correct: boolean, now: number): KartState {
  const kart = advanceKart(source, now);
  if (correct && !kart.finishedAt) {
    const kinds = ["boost", "missile", "shield"] as const;
    for (let i = 0; i < kinds.length; i++) {
      const kind = kinds[(kart.rewardsGiven + i) % kinds.length];
      if (kind === "boost" && kart.boostStock < 1) { kart.boostStock++; kart.lastCue = { kind: "reward_boost", at: now }; break; }
      if (kind === "missile" && kart.missiles < 1) { kart.missiles++; kart.lastCue = { kind: "reward_missile", at: now }; break; }
      if (kind === "shield" && kart.shields < 1) { kart.shields++; kart.lastCue = { kind: "reward_shield", at: now }; break; }
    }
    kart.rewardsGiven++;
  }
  return kart;
}

export function useKartItem(source: KartState, now: number): KartState {
  const kart = advanceKart(source, now);
  if ((!kart.boostStock && kart.charge < 3) || kart.finishedAt || now < kart.itemReadyAt) throw new Error("KART_ITEM_NOT_READY");
  if (kart.boostStock) kart.boostStock--; else kart.charge = 0;
  kart.itemReadyAt = now + 5000;
  kart.boostUntil = now + 5000;
  kart.lastCue = { kind: "boost", at: now };
  return kart;
}

export function useKartWeapon(source: KartState, now: number, requested?: KartWeapon): KartState {
  const kart = advanceKart(source, now);
  const weapon = requested || kart.heldItem;
  if (!weapon || kart.finishedAt || now < kart.itemReadyAt ||
    (weapon !== kart.heldItem && !(weapon === "missile" && kart.missiles) && !(weapon === "shield" && kart.shields))) throw new Error("KART_ITEM_NOT_READY");
  if (weapon === kart.heldItem) kart.heldItem = undefined;
  else if (weapon === "missile") kart.missiles--;
  else if (weapon === "shield") kart.shields--;
  kart.itemReadyAt = now + 1500;
  if (weapon === "banana") kart.banana = { at: Math.max(0, kart.distance - 4), lane: kart.lane, until: now + 14000 };
  if (weapon === "shield") kart.shieldUntil = now + 5000;
  if (weapon === "missile") kart.lastCue = { kind: "missile", at: now };
  return kart;
}

export function kartView(source: KartState, now: number) {
  const kart = advanceKart(source, now);
  return { design: kart.design || "teal", color: kart.color || "cyan", distance: Math.round(kart.distance), lane: kart.lane, speed: Math.round(kart.speed * 3.6),
    charge: Math.round(kart.charge * 100) / 100, boostStock: kart.boostStock, missiles: kart.missiles, shields: kart.shields,
    heldItem: kart.heldItem, banana: kart.banana && kart.banana.until > now ? kart.banana : undefined,
    lastCue: kart.lastCue && now - kart.lastCue.at < 2500 ? kart.lastCue : undefined,
    boosted: now < kart.boostUntil, shielded: now < kart.shieldUntil, slipping: now < kart.slipUntil,
    hit: now < kart.hitUntil && now < kart.slowUntil,
    finishedAt: kart.finishedAt, hits: kart.hits, pads: kart.pads, stars: kart.stars, seq: kart.seq };
}
