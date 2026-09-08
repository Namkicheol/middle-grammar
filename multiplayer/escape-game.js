const SYMBOLS = {
  moon: { icon: "☾", name: "달" },
  star: { icon: "✦", name: "별" },
  sun: { icon: "☀", name: "해" },
};

const ROOM_COPY = [
  { label: "전력실", objective: "퓨즈를 맞춰 비상 전력을 복구하세요.", action: "전력 복구" },
  { label: "자료실", objective: "봉인 순서대로 자료 타일을 정렬하세요.", action: "봉인 해제" },
  { label: "현관", objective: "출구 코드로 세 개의 다이얼을 맞추세요.", action: "출구 열기" },
];

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function knownHotspots(escape) {
  return (Array.isArray(escape?.hotspots) ? escape.hotspots : []).filter((spot) => spot.clue !== undefined && spot.clue !== null);
}

export function createEscapePuzzleDraft(escape, previous = null) {
  const roomIndex = Math.min(2, Math.max(0, Number(escape?.roomIndex || 0)));
  if (previous?.roomIndex === roomIndex) return previous;
  const hotspots = Array.isArray(escape?.hotspots) ? escape.hotspots : [];
  if (roomIndex === 1) return { roomIndex, values: hotspots.map((spot) => spot.id) };
  return { roomIndex, values: ["", "", ""] };
}

export function updateEscapePuzzleDraft(escape, draft, control) {
  const next = { ...createEscapePuzzleDraft(escape, draft), values: [...createEscapePuzzleDraft(escape, draft).values] };
  const index = Number(control?.index);
  if (!Number.isInteger(index) || index < 0 || index > 2) return next;
  if (control.kind === "set") next.values[index] = String(control.value ?? "").replace(/\D/g, "").slice(-1);
  if (control.kind === "spin") next.values[index] = String((Number(next.values[index] || 0) + Number(control.delta || 0) + 10) % 10);
  if (control.kind === "move") {
    const target = index + Number(control.delta || 0);
    if (target >= 0 && target < next.values.length) [next.values[index], next.values[target]] = [next.values[target], next.values[index]];
  }
  return next;
}

export function escapePuzzleCode(escape, draft) {
  const roomIndex = Math.min(2, Math.max(0, Number(escape?.roomIndex || 0)));
  const values = createEscapePuzzleDraft(escape, draft).values;
  if (roomIndex !== 1) return values.join("");
  const byId = new Map((escape?.hotspots || []).map((spot) => [spot.id, spot.clue]));
  return values.map((id) => byId.get(id) ?? "").join("");
}

function clueButtons(escape, draft, disabled) {
  const known = knownHotspots(escape);
  const order = Array.isArray(escape?.lockOrder) ? escape.lockOrder : [];
  return `<div class="power-sockets">${order.map((symbol, index) => {
    const meta = SYMBOLS[symbol] || { icon: "?", name: "기호" };
    return `<fieldset class="power-socket"><legend><span aria-hidden="true">${meta.icon}</span> ${meta.name} 소켓</legend><div class="fuse-bank">${known.map((spot) => `<button type="button" class="fuse ${draft.values[index] === String(spot.clue) ? "selected" : ""}" data-action="escape-puzzle-set" data-index="${index}" data-value="${esc(spot.clue)}" ${disabled ? "disabled" : ""} aria-pressed="${draft.values[index] === String(spot.clue)}">${esc(spot.clue)}</button>`).join("") || `<span class="apparatus-wait">단서 필요</span>`}</div></fieldset>`;
  }).join("")}</div>`;
}

function archiveTiles(escape, draft, disabled) {
  const byId = new Map((escape?.hotspots || []).map((spot) => [spot.id, spot]));
  return `<div class="archive-sequence" aria-label="자료 타일 순서">${draft.values.map((id, index) => {
    const spot = byId.get(id) || {}; const meta = SYMBOLS[spot.symbol] || { icon: "?", name: "기호" }; const known = spot.clue !== undefined && spot.clue !== null;
    return `<article class="archive-tile"><span class="tile-index">${index + 1}</span><strong><span aria-hidden="true">${meta.icon}</span> ${meta.name}</strong><span class="tile-clue">${known ? esc(spot.clue) : "?"}</span><div class="tile-moves"><button type="button" data-action="escape-puzzle-move" data-index="${index}" data-delta="-1" ${disabled || index === 0 ? "disabled" : ""} aria-label="${meta.name} 타일 왼쪽으로">←</button><button type="button" data-action="escape-puzzle-move" data-index="${index}" data-delta="1" ${disabled || index === draft.values.length - 1 ? "disabled" : ""} aria-label="${meta.name} 타일 오른쪽으로">→</button></div></article>`;
  }).join("")}</div>`;
}

function exitDials(draft, disabled) {
  return `<div class="exit-dials">${draft.values.map((value, index) => `<div class="exit-dial"><button type="button" data-action="escape-puzzle-spin" data-index="${index}" data-delta="1" ${disabled ? "disabled" : ""} aria-label="${index + 1}번 다이얼 숫자 올리기">▲</button><output aria-label="${index + 1}번 다이얼 현재 숫자">${esc(value || "0")}</output><button type="button" data-action="escape-puzzle-spin" data-index="${index}" data-delta="-1" ${disabled ? "disabled" : ""} aria-label="${index + 1}번 다이얼 숫자 내리기">▼</button></div>`).join("")}</div>`;
}

export function escapeRoomExperienceHtml({ escape = {}, draft, busy = false, retrySeconds = 0, connected = true } = {}) {
  const roomIndex = Math.min(2, Math.max(0, Number(escape.roomIndex || 0)));
  const copy = ROOM_COPY[roomIndex];
  const current = createEscapePuzzleDraft(escape, draft);
  const known = knownHotspots(escape);
  const allKnown = known.length === 3;
  const disabled = busy || !connected || !allKnown || retrySeconds > 0;
  const apparatus = roomIndex === 0 ? clueButtons(escape, current, disabled) : roomIndex === 1 ? archiveTiles(escape, current, disabled) : exitDials(current, disabled);
  const scene = ["night-school.webp", "night-archive.webp", "night-exit.webp"][roomIndex];
  const codeReady = /^\d{3}$/.test(escapePuzzleCode(escape, current));
  return `<section class="escape-room-scene room-${roomIndex + 1}" style="--escape-art:url('./assets/${scene}')" aria-labelledby="apparatus-title">
    <div class="scene-shade" aria-hidden="true"></div>
    <header class="scene-mission"><span>ROOM ${roomIndex + 1} · ${copy.label}</span><h2 id="apparatus-title">${copy.objective}</h2></header>
    <div class="scene-hotspots">${(escape.hotspots || []).map((spot) => { const found = spot.clue !== undefined && spot.clue !== null; const meta = SYMBOLS[spot.symbol] || { icon: "?", name: "기호" }; return `<button type="button" class="scene-hotspot ${found ? "found" : ""}" data-action="escape-inspect" data-hotspot-id="${esc(spot.id)}" ${(!found && (!Number(escape.focus) || busy || !connected)) ? "disabled" : ""}><span aria-hidden="true">${meta.icon}</span><strong>${esc(spot.label)}</strong><small>${found ? `${meta.name} ${esc(spot.clue)}` : "조사"}</small></button>`; }).join("")}</div>
    <section class="room-apparatus">${apparatus}<button type="button" class="apparatus-confirm" data-action="escape-puzzle-confirm" ${disabled || !codeReady ? "disabled" : ""}>${retrySeconds ? `${retrySeconds}초 후 다시` : copy.action}</button></section>
  </section>
  <section class="clue-strip" aria-label="찾은 단서">${(escape.hotspots || []).map((spot) => { const meta = SYMBOLS[spot.symbol] || { icon: "?", name: "기호" }; const found = spot.clue !== undefined && spot.clue !== null; return `<span class="clue-chip ${found ? "found" : ""}"><b aria-hidden="true">${meta.icon}</b>${meta.name}<strong>${found ? esc(spot.clue) : "?"}</strong></span>`; }).join("")}</section>`;
}
