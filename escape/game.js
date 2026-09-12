const DIRECTIONS = Object.freeze({
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
});

export const CLASSROOM_HOTSPOTS = Object.freeze([
  {
    id: 'board',
    label: '칠판 메모',
    x: 52,
    y: 33,
    clue: '칠판의 숫자 · 5',
    detail: '칠판 테두리의 별 옆에 숫자 5가 새겨져 있다. 화살표는 보드 → 캐비닛 → 서랍 순서로 읽으라고 한다.',
    value: '5',
  },
  {
    id: 'cabinet',
    label: '낡은 캐비닛',
    x: 29,
    y: 36,
    clue: '캐비닛의 숫자 · 2',
    detail: '캐비닛 손잡이 아래에 숫자 2가 새겨져 있다. 이 숫자는 캐비닛의 몫이다.',
    value: '2',
  },
  {
    id: 'desk',
    label: '교탁 서랍',
    x: 50,
    y: 56,
    clue: '서랍의 숫자 · 8',
    detail: '손전등을 비추자 서랍 바닥에 숫자 8이 새겨져 있다. 이 숫자는 서랍의 몫이다.',
    value: '8',
  },
  {
    id: 'classroom-door',
    label: '자료실 문',
    x: 88,
    y: 42,
    locked: true,
    detail: '복도 쪽 문은 잠겨 있다. 교실 안에서 단서를 더 찾아야 한다.',
  },
]);

export const ARCHIVE_HOTSPOTS = Object.freeze([
  {
    id: 'clock',
    label: '멈춘 시계',
    x: 25,
    y: 10,
    clue: '상대 순서 · 시계 → 장부',
    detail: '멈춘 시계 뒤 메모에 장부는 시계 다음에 놓인다고 적혀 있다.',
    order: 1,
  },
  {
    id: 'books',
    label: '색 바랜 장부',
    x: 49,
    y: 55,
    clue: '상대 순서 · 장부 → 수납칸',
    detail: '장부 사이 쪽지는 수납칸을 장부 다음에 닫으라고 가리킨다.',
    order: 2,
  },
  {
    id: 'compartment',
    label: '황동 수납칸',
    x: 47,
    y: 66,
    clue: '수납칸의 표시',
    detail: '황동 수납칸 안쪽에 작은 열쇠 모양 표시가 남아 있다.',
    order: 3,
  },
  {
    id: 'archive-door',
    label: '복도 문',
    x: 85,
    y: 42,
    locked: true,
    detail: '복도 문은 열리지 않는다. 자료실의 순서를 먼저 맞혀야 한다.',
  },
]);

export const MAZE = Object.freeze([
  '###############',
  '#S....#.......#',
  '###.#.#.#####.#',
  '#...#.#.....#.#',
  '#.###.#####.#.#',
  '#.....#.....#.#',
  '#.#####.#####.#',
  '#...........E.#',
  '###############',
]);

export const CLASSROOM_CODE = '528';
export const ARCHIVE_ORDER = Object.freeze(['clock', 'books', 'compartment']);
export const ARCHIVE_SCRAMBLE = Object.freeze(['compartment', 'clock', 'books']);

const cloneState = (state) => JSON.parse(JSON.stringify(state));
const hotspotFor = (scene, id) => {
  const list = scene === 'classroom' ? CLASSROOM_HOTSPOTS : ARCHIVE_HOTSPOTS;
  return list.find((hotspot) => hotspot.id === id);
};
const roomKey = (scene) => (scene === 'classroom' || scene === 'archive' ? scene : null);
const roomIsReady = (state, scene) => {
  const key = roomKey(scene);
  return Boolean(key && state.discovered[key].length >= 3);
};

const messageForScene = (scene) => {
  if (scene === 'classroom') return '불이 꺼진 교실이다. 주변의 반짝이는 지점을 살펴보자.';
  if (scene === 'archive') return '자료실의 먼지가 가라앉는다. 기록의 순서를 맞혀 보자.';
  return '복도 끝의 희미한 불빛을 따라가자. 방향키 또는 WASD로 이동한다.';
};

export function getSceneHotspots(scene) {
  return scene === 'classroom' ? CLASSROOM_HOTSPOTS : scene === 'archive' ? ARCHIVE_HOTSPOTS : [];
}

export function getMazeStart() {
  const y = MAZE.findIndex((row) => row.includes('S'));
  return { x: MAZE[y].indexOf('S'), y };
}

export function getMazeExit() {
  const y = MAZE.findIndex((row) => row.includes('E'));
  return { x: MAZE[y].indexOf('E'), y };
}

export function isMazeWalkable(x, y) {
  return Boolean(MAZE[y] && MAZE[y][x] && MAZE[y][x] !== '#');
}

export function createInitialState() {
  const start = getMazeStart();
  return {
    scene: 'classroom',
    discovered: { classroom: [], archive: [] },
    inventory: { keys: [], clues: [] },
    classroomCode: ['', '', ''],
    archiveOrder: [...ARCHIVE_SCRAMBLE],
    puzzleReady: { classroom: false, archive: false },
    player: { ...start, facing: 'up' },
    steps: 0,
    message: messageForScene('classroom'),
    lastEvent: '',
    won: false,
  };
}

function inspectHotspot(next, id) {
  const hotspot = hotspotFor(next.scene, id);
  if (!hotspot) return next;
  if (hotspot.locked) {
    next.message = hotspot.detail;
    next.lastEvent = 'click';
    return next;
  }

  const discovered = next.discovered[next.scene];
  const alreadyFound = discovered.includes(hotspot.id);
  if (!alreadyFound) {
    discovered.push(hotspot.id);
    next.inventory.clues.push({ scene: next.scene, id: hotspot.id, label: hotspot.label, clue: hotspot.clue });
    next.message = `${hotspot.label}: ${hotspot.detail}`;
    next.lastEvent = 'pickup';
  } else {
    next.message = `${hotspot.label}: 이미 확인한 단서다.`;
    next.lastEvent = 'click';
  }
  if (roomIsReady(next, next.scene)) next.puzzleReady[next.scene] = true;
  return next;
}

function setClassroomDigit(next, index, value) {
  if (next.scene !== 'classroom' || !Number.isInteger(index) || index < 0 || index > 2) return next;
  if (!/^[0-9]$/.test(String(value))) return next;
  next.classroomCode[index] = String(value);
  next.message = `교실 잠금 숫자 ${index + 1}번째 칸을 ${value}(으)로 맞췄다.`;
  next.lastEvent = 'click';
  return next;
}

function solveClassroom(next) {
  if (next.scene !== 'classroom') return next;
  if (!roomIsReady(next, 'classroom')) {
    next.message = '잠금장치를 움직이기 전에 교실의 단서 세 곳을 확인하자.';
    next.lastEvent = 'wrong';
    return next;
  }
  if (next.classroomCode.join('') !== CLASSROOM_CODE) {
    next.message = '딸깍 소리가 났지만 순서가 틀렸다. 단서를 다시 읽어 보자.';
    next.lastEvent = 'wrong';
    return next;
  }
  next.inventory.keys.push('archive');
  next.scene = 'archive';
  next.message = '잠금이 풀렸다. 자료실 열쇠를 챙겨 다음 방으로 가자.';
  next.lastEvent = 'unlock';
  return next;
}

function moveArchiveTile(next, index, delta) {
  if (next.scene !== 'archive' || !roomIsReady(next, 'archive')) return next;
  if (!Number.isInteger(index) || !Number.isInteger(delta)) return next;
  const target = index + delta;
  if (index < 0 || target < 0 || index >= next.archiveOrder.length || target >= next.archiveOrder.length) return next;
  [next.archiveOrder[index], next.archiveOrder[target]] = [next.archiveOrder[target], next.archiveOrder[index]];
  next.message = '기록 조각을 옮겼다. 시계 → 장부 → 수납칸 순서인지 살펴보자.';
  next.lastEvent = 'click';
  return next;
}

function solveArchive(next) {
  if (next.scene !== 'archive') return next;
  if (!roomIsReady(next, 'archive')) {
    next.message = '자료실의 단서 세 곳을 먼저 확인하자.';
    next.lastEvent = 'wrong';
    return next;
  }
  if (next.archiveOrder.join('|') !== ARCHIVE_ORDER.join('|')) {
    next.message = '수납칸이 움직이지 않는다. 두 화살표 단서를 다시 대조해 보자.';
    next.lastEvent = 'wrong';
    return next;
  }
  next.inventory.keys.push('corridor');
  next.scene = 'maze';
  next.player = getMazeStart();
  next.message = '황동 잠금이 열렸다. 복도 열쇠를 들고 출구를 찾아가자.';
  next.lastEvent = 'unlock';
  return next;
}

function moveMaze(next, direction) {
  if (next.scene !== 'maze' || next.won) return next;
  const vector = DIRECTIONS[direction];
  if (!vector) return next;
  const x = next.player.x + vector[0];
  const y = next.player.y + vector[1];
  if (!isMazeWalkable(x, y)) {
    next.message = '벽이 앞을 막고 있다. 다른 길을 찾아보자.';
    next.lastEvent = 'wrong';
    return next;
  }
  next.player = { x, y, facing: direction };
  next.steps += 1;
  next.lastEvent = 'step';
  const exit = getMazeExit();
  if (x === exit.x && y === exit.y) {
    next.won = true;
    next.message = '차가운 밤공기가 스며든다. 야간학교를 빠져나왔다.';
    next.lastEvent = 'win';
  } else {
    next.message = '발소리가 복도에 짧게 울린다. 희미한 출구 표시를 따라가자.';
  }
  return next;
}

export function reduceState(state, action = {}) {
  const next = cloneState(state || createInitialState());
  next.lastEvent = '';
  if (!action || typeof action.type !== 'string') return next;
  switch (action.type) {
    case 'inspect':
      return inspectHotspot(next, action.id);
    case 'set-room-digit':
      return setClassroomDigit(next, action.index, action.value);
    case 'solve-room':
      return solveClassroom(next);
    case 'move-archive':
      return moveArchiveTile(next, action.index, action.delta);
    case 'solve-archive':
      return solveArchive(next);
    case 'move-maze':
      return moveMaze(next, action.direction);
    case 'restart':
      return createInitialState();
    default:
      return next;
  }
}

const SCENE_COPY = Object.freeze({
  classroom: {
    eyebrow: '01 · 교실',
    title: '꺼진 교실',
    objective: '교실 안 단서 3곳을 찾아 자료실 열쇠의 숫자를 완성한다.',
    hint: '반짝이는 표식을 눌러 주변을 살펴보자.',
    artLabel: '밤의 교실 장면',
  },
  archive: {
    eyebrow: '02 · 자료실',
    title: '멈춘 자료실',
    objective: '기록의 순서를 맞혀 복도로 향하는 열쇠를 찾는다.',
    hint: '시계, 장부, 수납칸의 단서를 차례로 읽어 보자.',
    artLabel: '밤의 자료실 장면',
  },
  maze: {
    eyebrow: '03 · 복도',
    title: '안개 낀 복도',
    objective: '방향키 또는 WASD로 벽을 피해 희미한 출구까지 간다.',
    hint: '가까운 공간만 보인다. 한 칸씩 천천히 움직이자.',
    artLabel: '안개 낀 복도 미로',
  },
});

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const root = typeof document === 'undefined' ? null : document.getElementById('escape-root');
let state = createInitialState();
let moveTimer = null;
let suppressNextMazeClick = false;
let audioUnlocked = false;
let audioMuted = false;

const getAudio = () => (typeof window !== 'undefined' && window.EscapeAudio ? window.EscapeAudio : null);
const audioIsMuted = (audio) => typeof audio?.isMuted === 'function' ? audio.isMuted() : Boolean(audio?.isMuted);
audioMuted = audioIsMuted(getAudio());

function unlockAudio() {
  const audio = getAudio();
  if (!audio) return;
  if (!audioUnlocked) {
    try { audio.unlock?.(); } catch { /* audio is an optional enhancement */ }
    try { audio.startAmbient?.(); } catch { /* audio is an optional enhancement */ }
    audioUnlocked = true;
  }
}

function playSound(name) {
  try { getAudio()?.play?.(name); } catch { /* audio is an optional enhancement */ }
}

function clearMoveTimer() {
  if (moveTimer !== null) {
    window.clearInterval(moveTimer);
    moveTimer = null;
  }
}

function setAudioButton() {
  const button = document.getElementById('audio-toggle');
  if (!button) return;
  const muted = audioMuted || audioIsMuted(getAudio());
  button.setAttribute('aria-pressed', String(muted));
  button.setAttribute('aria-label', muted ? '소리 켜기' : '소리 끄기');
  button.innerHTML = `${muted ? '♩' : '♫'} <span>${muted ? '소리 꺼짐' : '소리 켜짐'}</span>`;
}

function updateProgress() {
  document.querySelectorAll('[data-progress]').forEach((step) => {
    const sceneOrder = ['classroom', 'archive', 'maze'];
    const sceneIndex = sceneOrder.indexOf(state.scene);
    const stepIndex = sceneOrder.indexOf(step.dataset.progress);
    step.classList.toggle('active', stepIndex === sceneIndex);
    step.classList.toggle('done', stepIndex < sceneIndex || state.won && stepIndex === sceneIndex);
  });
}

function renderInventory() {
  const keyLabels = { archive: '자료실 열쇠', corridor: '복도 열쇠' };
  const keys = state.inventory.keys.map((key) => `<span class="inventory-chip key-chip"><i>⌕</i>${escapeHtml(keyLabels[key] || key)}</span>`).join('');
  const clues = state.inventory.clues.length
    ? state.inventory.clues.map((clue) => `<span class="inventory-chip clue-chip"><i>✦</i>${escapeHtml(clue.label)}</span>`).join('')
    : '<span class="empty-copy">아직 기록한 단서가 없다.</span>';
  return `<section class="inventory-section" aria-labelledby="inventory-title">
    <div class="section-heading"><h2 id="inventory-title">챙긴 것</h2><span>${state.inventory.keys.length} 열쇠 · ${state.inventory.clues.length} 단서</span></div>
    <div class="inventory-list">${keys || '<span class="empty-copy">열쇠를 찾으면 여기에 표시된다.</span>'}</div>
    <div class="clue-list">${clues}</div>
  </section>`;
}

function renderRoomClues(scene) {
  const clues = state.inventory.clues.filter((clue) => clue.scene === scene);
  if (!clues.length) return '<p class="empty-copy">표식을 눌러 주변을 살펴보면 기록이 남는다.</p>';
  return `<ul class="clue-notes">${clues.map((clue) => `<li><span>${escapeHtml(clue.clue)}</span><strong>${escapeHtml(clue.label)}</strong></li>`).join('')}</ul>`;
}

function renderClassroomPuzzle() {
  if (!state.puzzleReady.classroom) {
    return `<section class="puzzle-card puzzle-locked" aria-label="자료실 열쇠 잠금">
      <div class="puzzle-topline"><span class="lock-mark">⌑</span><div><span class="puzzle-label">LOCKED · 자료실 열쇠</span><h2>세 숫자가 필요하다</h2></div></div>
      <p>교실의 표식 3곳을 모두 확인하면 숫자 잠금이 열린다.</p>
      <div class="puzzle-progress"><span style="--progress:${state.discovered.classroom.length / 3 * 100}%"></span></div>
      <small>${state.discovered.classroom.length} / 3 단서 확인</small>
    </section>`;
  }
  return `<section class="puzzle-card" aria-labelledby="room-lock-title">
    <div class="puzzle-topline"><span class="lock-mark open">⌑</span><div><span class="puzzle-label">UNLOCK · 자료실 열쇠</span><h2 id="room-lock-title">숫자 잠금</h2></div></div>
    <p>단서가 가리킨 순서대로 세 칸을 맞춘다.</p>
    <div class="code-dials">${state.classroomCode.map((value, index) => `<label><span>${index + 1}번째</span><select data-action="set-room-digit" data-index="${index}" aria-label="${index + 1}번째 숫자"><option value="">—</option>${Array.from({ length: 10 }, (_, digit) => `<option value="${digit}" ${String(digit) === value ? 'selected' : ''}>${digit}</option>`).join('')}</select></label>`).join('')}</div>
    <button class="primary-action" type="button" data-action="solve-room">잠금 해제 <span>→</span></button>
  </section>`;
}

function renderArchivePuzzle() {
  if (!state.puzzleReady.archive) {
    return `<section class="puzzle-card puzzle-locked" aria-label="복도 열쇠 잠금">
      <div class="puzzle-topline"><span class="lock-mark">⌑</span><div><span class="puzzle-label">LOCKED · 복도 열쇠</span><h2>기록을 더 읽어야 한다</h2></div></div>
      <p>자료실의 표식 3곳을 살펴보면 잠금 순서가 드러난다.</p>
      <div class="puzzle-progress"><span style="--progress:${state.discovered.archive.length / 3 * 100}%"></span></div>
      <small>${state.discovered.archive.length} / 3 단서 확인</small>
    </section>`;
  }
  const labels = { clock: '시계', books: '장부', compartment: '수납칸' };
  return `<section class="puzzle-card" aria-labelledby="archive-lock-title">
    <div class="puzzle-topline"><span class="lock-mark open">⌑</span><div><span class="puzzle-label">UNLOCK · 복도 열쇠</span><h2 id="archive-lock-title">기록의 순서</h2></div></div>
    <p>수집한 단서의 앞뒤 관계를 맞춰 기록을 정렬한다.</p>
    <ol class="order-list">${state.archiveOrder.map((id, index) => `<li><span class="order-number">0${index + 1}</span><strong>${labels[id]}</strong><span class="order-controls"><button type="button" data-action="move-archive" data-index="${index}" data-delta="-1" aria-label="${labels[id]} 위로 이동" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-action="move-archive" data-index="${index}" data-delta="1" aria-label="${labels[id]} 아래로 이동" ${index === state.archiveOrder.length - 1 ? 'disabled' : ''}>↓</button></span></li>`).join('')}</ol>
    <button class="primary-action" type="button" data-action="solve-archive">순서 확인 <span>→</span></button>
  </section>`;
}

function renderPuzzle(scene) {
  if (scene === 'classroom') return renderClassroomPuzzle();
  if (scene === 'archive') return renderArchivePuzzle();
  return `<section class="puzzle-card route-card"><span class="puzzle-label">WAY OUT · 출구</span><h2>발밑을 확인하며 이동</h2><p>가까운 타일만 보이는 복도다. 벽은 지나갈 수 없다.</p><div class="keyboard-hint"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>또는 방향키</span></div></section>`;
}

function renderHotspots(scene) {
  return getSceneHotspots(scene).map((hotspot) => {
    const found = state.discovered[scene]?.includes(hotspot.id);
    return `<button class="scene-hotspot${found ? ' found' : ''}${hotspot.locked ? ' locked' : ''}" style="--x:${hotspot.x};--y:${hotspot.y}" type="button" data-action="inspect" data-id="${hotspot.id}" aria-label="${escapeHtml(hotspot.label)}${found ? ' · 확인함' : ''}"><span class="hotspot-pin" aria-hidden="true"></span><span class="hotspot-label">${escapeHtml(hotspot.label)}</span>${found ? '<span class="hotspot-check" aria-hidden="true">✓</span>' : ''}</button>`;
  }).join('');
}

function renderMaze(scene) {
  const radius = 3;
  const tiles = MAZE.flatMap((row, y) => [...row].map((tile, x) => {
    const visible = Math.abs(x - state.player.x) + Math.abs(y - state.player.y) <= radius;
    const isPlayer = x === state.player.x && y === state.player.y;
    const isExit = tile === 'E';
    const classNames = [tile === '#' ? 'maze-wall' : 'maze-floor', isPlayer ? 'maze-player' : '', isExit ? 'maze-exit' : '', visible ? '' : 'maze-fog'].filter(Boolean).join(' ');
    const label = isPlayer ? '현재 위치' : isExit ? '출구' : tile === '#' ? '벽' : visible ? '복도' : '안개';
    return `<span class="maze-tile ${classNames}" aria-label="${label}">${isPlayer ? `<i class="explorer-sprite facing-${state.player.facing || 'up'}" aria-hidden="true"></i>` : isExit && visible ? '<b aria-hidden="true">EXIT</b>' : ''}</span>`;
  })).join('');
  const playerX = `${((state.player.x + 0.5) / MAZE[0].length) * 100}%`;
  const playerY = `${((state.player.y + 0.5) / MAZE.length) * 100}%`;
  return `<div class="maze-grid" role="img" aria-label="${SCENE_COPY[scene].artLabel}" style="--maze-columns:${MAZE[0].length};--player-x:${playerX};--player-y:${playerY}">${tiles}</div>`;
}

function renderDpad() {
  return `<div class="dpad-wrap" aria-label="복도 이동 패드">
    <div class="dpad">
      <span></span><button type="button" data-action="move-maze" data-direction="up" aria-label="위로 이동">↑</button><span></span>
      <button type="button" data-action="move-maze" data-direction="left" aria-label="왼쪽으로 이동">←</button><span class="dpad-center">✦</span><button type="button" data-action="move-maze" data-direction="right" aria-label="오른쪽으로 이동">→</button>
      <span></span><button type="button" data-action="move-maze" data-direction="down" aria-label="아래로 이동">↓</button><span></span>
    </div>
    <span class="dpad-note">터치 패드 · 방향키 · WASD</span>
  </div>`;
}

function renderScenePanel(scene) {
  const copy = SCENE_COPY[scene];
  const artClass = scene === 'classroom' ? 'classroom-art' : scene === 'archive' ? 'archive-art' : 'maze-art';
  const artContent = scene === 'maze' ? renderMaze(scene) : renderHotspots(scene);
  return `<section class="scene-panel" aria-labelledby="scene-title">
    <div class="scene-meta"><span class="scene-eyebrow">${copy.eyebrow}</span><span class="scene-coordinates">${scene === 'maze' ? `${state.player.x + 1} : ${state.player.y + 1}` : '탐색 가능'}</span></div>
    <div class="scene-art ${artClass}" data-scene="${scene}" role="group" aria-label="${copy.artLabel}">${artContent}<span class="scene-vignette" aria-hidden="true"></span>${state.won ? `<div class="victory-card" role="status"><span class="victory-kicker">ESCAPE COMPLETE</span><h2>탈출 성공</h2><p>희미한 불빛을 따라 ${state.steps}걸음 만에 학교 밖으로 나왔다.</p><div class="victory-actions"><button type="button" data-action="restart">다시 시작</button><a href="../game/">게임 선택</a></div></div>` : ''}</div>
    ${scene === 'maze' ? renderDpad() : '<p class="scene-tip"><span>✦</span> 빛나는 표식은 조사할 수 있는 지점이다.</p>'}
  </section>`;
}

function renderInfoPanel(scene) {
  const copy = SCENE_COPY[scene];
  const clueCount = state.discovered[scene]?.length || 0;
  return `<aside class="info-panel">
    <div class="info-heading"><span class="scene-eyebrow">${copy.eyebrow}</span><h2 id="scene-title">${copy.title}</h2><p>${copy.hint}</p></div>
    <div class="objective-strip"><span class="objective-icon">◎</span><div><strong>현재 목표</strong><span>${state.won ? '밖으로 나왔다. 다시 도전할 수 있다.' : copy.objective}</span></div></div>
    ${renderInventory()}
    <section class="notes-section" aria-labelledby="notes-title"><div class="section-heading"><h2 id="notes-title">현장 기록</h2><span>${scene === 'maze' ? '안개 속' : `${clueCount} / 3`}</span></div>${renderRoomClues(scene)}</section>
    ${renderPuzzle(scene)}
    <div class="event-log" role="status" aria-live="polite"><span class="event-pip" aria-hidden="true"></span><span>${escapeHtml(state.message)}</span></div>
  </aside>`;
}

function render() {
  if (!root) return;
  if (state.scene !== 'maze') clearMoveTimer();
  root.innerHTML = `${renderScenePanel(state.scene)}${renderInfoPanel(state.scene)}`;
  updateProgress();
  setAudioButton();
}

function dispatch(action, options = {}) {
  unlockAudio();
  const previousScene = state.scene;
  const previousWon = state.won;
  state = reduceState(state, action);
  if (state.lastEvent === 'win') {
    try { getAudio()?.stopAmbient?.(); } catch { /* audio is an optional enhancement */ }
  }
  if (action.type === 'restart' && audioUnlocked && !state.won) {
    try { getAudio()?.startAmbient?.(); } catch { /* audio is an optional enhancement */ }
  }
  if (state.lastEvent) playSound(state.lastEvent);
  render();
  if (previousScene !== state.scene || (!previousWon && state.won)) {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo?.({ top: 0, behavior: reduced ? 'instant' : 'smooth' });
  }
  if (state.scene !== 'maze' || state.won) clearMoveTimer();
  if (!options.fromRepeat && state.scene === 'maze' && action.type !== 'move-maze') clearMoveTimer();
}

function handleAction(element) {
  const action = element.dataset.action;
  if (action === 'inspect') dispatch({ type: 'inspect', id: element.dataset.id });
  else if (action === 'set-room-digit') dispatch({ type: 'set-room-digit', index: Number(element.dataset.index), value: element.value });
  else if (action === 'solve-room') dispatch({ type: 'solve-room' });
  else if (action === 'move-archive') dispatch({ type: 'move-archive', index: Number(element.dataset.index), delta: Number(element.dataset.delta) });
  else if (action === 'solve-archive') dispatch({ type: 'solve-archive' });
  else if (action === 'move-maze') dispatch({ type: 'move-maze', direction: element.dataset.direction });
  else if (action === 'restart') dispatch({ type: 'restart' });
}

if (root) {
  root.addEventListener('click', (event) => {
    const element = event.target.closest('[data-action]');
    if (!element) return;
    if (element.dataset.action === 'move-maze' && suppressNextMazeClick) {
      suppressNextMazeClick = false;
      return;
    }
    handleAction(element);
  });
  root.addEventListener('change', (event) => {
    const element = event.target.closest('[data-action="set-room-digit"]');
    if (element) handleAction(element);
  });
  root.addEventListener('pointerdown', (event) => {
    const element = event.target.closest('[data-action="move-maze"]');
    if (!element || state.scene !== 'maze' || state.won) return;
    event.preventDefault();
    suppressNextMazeClick = true;
    unlockAudio();
    clearMoveTimer();
    handleAction(element);
    moveTimer = window.setInterval(() => {
      if (state.scene !== 'maze' || state.won) return clearMoveTimer();
      dispatch({ type: 'move-maze', direction: element.dataset.direction }, { fromRepeat: true });
    }, 220);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((eventName) => {
    root.addEventListener(eventName, () => {
      clearMoveTimer();
      if (eventName !== 'pointerup') suppressNextMazeClick = false;
      else window.setTimeout(() => { suppressNextMazeClick = false; }, 0);
    });
  });
  window.addEventListener('pointerup', () => {
    clearMoveTimer();
    window.setTimeout(() => { suppressNextMazeClick = false; }, 0);
  });
  window.addEventListener('pointercancel', () => {
    clearMoveTimer();
    suppressNextMazeClick = false;
  });
  window.addEventListener('blur', () => {
    clearMoveTimer();
    suppressNextMazeClick = false;
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (event) => {
    if (state.scene !== 'maze' || state.won) return;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target?.tagName)) return;
    const direction = {
      ArrowUp: 'up', w: 'up', W: 'up',
      ArrowDown: 'down', s: 'down', S: 'down',
      ArrowLeft: 'left', a: 'left', A: 'left',
      ArrowRight: 'right', d: 'right', D: 'right',
    }[event.key];
    if (!direction) return;
    event.preventDefault();
    dispatch({ type: 'move-maze', direction });
  });

  const audioToggle = document.getElementById('audio-toggle');
  audioToggle?.addEventListener('click', () => {
    unlockAudio();
    audioMuted = !audioMuted;
    try { getAudio()?.setMuted?.(audioMuted); } catch { /* audio is an optional enhancement */ }
    setAudioButton();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      try { getAudio()?.stopAmbient?.(); } catch { /* audio is an optional enhancement */ }
    } else if (!state.won && audioUnlocked) {
      try { getAudio()?.startAmbient?.(); } catch { /* audio is an optional enhancement */ }
    }
  });

  render();
}
