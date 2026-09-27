/* Shared race surface for solo and classroom rooms. No network assumptions here. */
(function () {
  'use strict';
  const art = {};
  const KART_PAINT = { cyan: '#35d6dc', coral: '#f65b65', gold: '#ffd04e', violet: '#a879ed', lime: '#94db64', pink: '#ef8bc0' };
  if (typeof Image !== 'undefined') {
    for (const [key, file] of Object.entries({ backdrop: 'neon-circuit-bg.webp', roadside: 'roadside-atlas.webp', obstacles: 'race-obstacles-atlas.webp', items: 'race-items-atlas.webp', teal: 'kart-rear-teal.webp', red: 'kart-rear-red.webp', yellow: 'kart-rear-yellow.webp' })) {
      const img = new Image(); img.decoding = 'async'; img.src = `assets/art/${file}`; art[key] = img;
    }
    for (const design of ['teal', 'red', 'yellow']) for (const pose of ['left', 'right']) {
      const img = new Image(); img.decoding = 'async'; img.src = `assets/art/kart-${pose}-${design}.webp`;
      art[`${design}-${pose}`] = img;
    }
    for (const design of ['teal', 'red', 'yellow']) {
      const img = new Image(); img.decoding = 'async'; img.src = `assets/art/kart-showcase-${design}.webp`;
      art[`showcase-${design}`] = img;
    }
    art.variants = new Map();
  }
  const TOTAL = 1800;
  const QUESTION_MARKS = [550, 1100, 1650];
  const COLORS = ['#ffce51', '#f66a60', '#69def0', '#b79aff', '#8ee47e', '#ff9ccb'];
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const norm = s => String(s).trim().toLowerCase().replace(/[.!?\s]+/g, '');
  function surfacePattern(ctx, grass) {
    const tile = document.createElement('canvas'); tile.width = tile.height = 96;
    const ink = tile.getContext('2d');
    let seed = grass ? 419 : 811;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < (grass ? 125 : 240); i++) {
      const x = random() * 96, y = random() * 96;
      ink.fillStyle = grass ? (i % 3 ? '#ded0a328' : '#203e3d35') : (i % 3 ? '#d9e1d323' : '#141f2a28');
      ink.fillRect(x, y, grass ? 1 + random() * 5 : 1 + random() * 2, 1);
    }
    return ctx.createPattern(tile, 'repeat');
  }
  function tinted(source, key, color) {
    if (!source?.complete || !source.naturalWidth) return null;
    if (art.variants.has(key)) return art.variants.get(key);
    const canvas = document.createElement('canvas'); canvas.width = source.naturalWidth; canvas.height = source.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const hex = KART_PAINT[color] || KART_PAINT.cyan;
    const target = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
    for (let i = 0; i < pixels.data.length; i += 4) {
      const r = pixels.data[i], g = pixels.data[i+1], b = pixels.data[i+2];
      const hi = Math.max(r,g,b), lo = Math.min(r,g,b), spread = hi - lo;
      if (pixels.data[i+3] < 10 || hi < 70 || spread < 27) continue;
      const amount = Math.min(.88, (spread / 100) * .65);
      const light = (r + g + b) / 3 / 170;
      for (let channel = 0; channel < 3; channel++) pixels.data[i+channel] = pixels.data[i+channel] * (1-amount) + target[channel] * light * amount;
    }
    context.putImageData(pixels, 0, 0);
    art.variants.set(key, canvas);
    return canvas;
  }
  function spriteFor(design, color, pose = 'rear') {
    const turn = art[`${design}-${pose}`];
    const source = turn?.complete && turn.naturalWidth ? turn : art[design] || art.teal;
    return tinted(source, `${design}:${color}:${source === turn ? pose : 'rear'}`, color);
  }
  function paintPreview(canvas, design = 'teal', color = 'cyan') {
    const image = spriteFor(design, color);
    if (!image) { art[design]?.addEventListener('load', () => paintPreview(canvas, design, color), { once: true }); return; }
    const context = canvas.getContext('2d'); context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  }
  function paintShowcase(canvas, design = 'teal', color = 'cyan') {
    const source = art[`showcase-${design}`]?.naturalWidth ? art[`showcase-${design}`] : art[design];
    const image = tinted(source, `showcase:${design}:${color}:${source === art[design] ? 'fallback' : 'full'}`, color);
    if (!image) { source?.addEventListener('load', () => paintShowcase(canvas, design, color), { once: true }); return; }
    const context = canvas.getContext('2d'); context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  }
  const COURSE = Array.from({ length: 13 }, (_, i) => {
    const base = 115 + i * 125;
    const obstacleLane = [-.55, 0, .55, 0, .55, -.55][i % 6];
    const padLane = obstacleLane === 0 ? (i % 2 ? -.55 : .55) : 0;
    return [
      { at: base, lane: obstacleLane, kind: 'cone' },
      { at: base + 20, lane: padLane, kind: 'pad' },
      { at: base + 43, lane: -padLane || -.55, kind: 'star' },
      { at: base + 68, lane: i % 2 ? .55 : -.55, kind: 'box' },
      ...(i % 2 === 0 ? [{ at: base + 96, lane: i % 4 ? -.55 : .55, kind: 'banana' }] : [])
    ];
  }).flat().filter(event => !(['cone','banana'].includes(event.kind) && QUESTION_MARKS.some(mark => event.at >= mark - 20 && event.at <= mark + 270)));

  function makeRace(options) {
    const { canvas, lesson, mode = 'solo', onProgress = () => {}, onAnswer = () => {}, onFinish = () => {}, onQuestion = () => {} } = options;
    const ctx = canvas.getContext('2d');
    const asphaltGrain = surfacePattern(ctx, false), grassGrain = surfacePattern(ctx, true);
    const pool = ((typeof GAME_QUESTIONS !== 'undefined' && GAME_QUESTIONS[lesson]?.questions) || [])
      .filter(q => Array.isArray(q.opts) && q.opts.length === 4 && q.opts.some(o => norm(o) === norm(q.ans)));
    let deck = [];
    let deckIndex = 0;
    let raf = 0;
    let previous = 0;
    let elapsed = 0;
    let questionIndex = 0;
    let question = null;
    let questionDeadline = 0;
    let playing = false;
    let finished = false;
    let steer = 0;
    let lean = 0;
    let driftTime = 0;
    let draftTime = 0;
    let draftUntil = 0;
    let wasOffRoad = false;
    let lane = 0;
    let distance = 0;
    let speed = 0;
    let boostUntil = 0;
    let slowUntil = 0;
    let shieldUntil = 0;
    let slipUntil = 0;
    let charge = 0;
    let boostStock = 0;
    let missiles = 0;
    let shields = 0;
    let rewardsGiven = 0;
    let heldItem = '';
    let bananas = [];
    let missilesInFlight = [];
    let impacts = [];
    let seenCues = new Set();
    let remoteInitialized = false;
    let correct = 0;
    let asked = 0;
    let combos = 0;
    let hitUntil = 0;
    let obstaclesHit = 0;
    let padsTaken = 0;
    let starsTaken = 0;
    let opponents = [];
    let effects = [];
    let progressAt = 0;
    let drawnAt = 0;
    let size = { w: 0, h: 0, scale: 0 };
    let destroyed = false;
    const ai = [
      { id: 'comet', name: '코멧', color: COLORS[1], design: 'red', kartColor: 'coral', base: 23.3, wobble: .19, distance: 0, lane: -.5 },
      { id: 'bolt', name: '볼트', color: COLORS[2], design: 'yellow', kartColor: 'gold', base: 24.2, wobble: .29, distance: 0, lane: .5 },
      { id: 'nova', name: '노바', color: COLORS[3], design: 'teal', kartColor: 'violet', base: 22, wobble: .37, distance: 0, lane: 0 }
    ];
    if (mode === 'solo') opponents = ai;
    const playerDesign = options.kartDesign || 'teal', playerColor = options.kartColor || 'cyan';
    for (const pose of ['rear', 'left', 'right']) {
      const source = art[pose === 'rear' ? playerDesign : `${playerDesign}-${pose}`];
      if (source?.complete && source.naturalWidth) spriteFor(playerDesign, playerColor, pose);
      else source?.addEventListener('load', () => spriteFor(playerDesign, playerColor, pose), { once: true });
    }

    function shuffle() {
      deck = [...pool];
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      deckIndex = 0;
    }
    function nextQuestion() {
      if (!pool.length || question || finished) return;
      if (deckIndex >= deck.length) shuffle();
      question = deck[deckIndex++];
      questionDeadline = elapsed + 16;
      asked++;
      onQuestion({ question, number: asked, seconds: 16 });
    }
    function answer(choice) {
      if (!question || finished) return false;
      const q = question;
      const good = norm(choice) === norm(q.ans);
      question = null;
      let reward = '';
      if (good) {
        correct++;
        combos++;
        const kinds = ['boost', 'missile', 'shield'];
        for (let i = 0; i < kinds.length; i++) {
          const kind = kinds[(rewardsGiven + i) % kinds.length];
          if (kind === 'boost' && boostStock < 1) { boostStock++; reward = kind; break; }
          if (kind === 'missile' && missiles < 1) { missiles++; reward = kind; break; }
          if (kind === 'shield' && shields < 1) { shields++; reward = kind; break; }
        }
        rewardsGiven++;
        effects.push({ text: ({ boost: 'BOOST 획득!', missile: 'MISSILE 획득!', shield: 'SHIELD 획득!' })[reward], until: elapsed + 1.1, color: '#ffe36c' });
      } else {
        combos = 0;
        effects.push({ text: '계속 달려!', until: elapsed + .9, color: '#ffafaa' });
      }
      onAnswer({ questionId: q.id, choice, correct: good, answer: q.ans, charge, boostStock, missiles, shields, reward, correctCount: correct, asked, distance: Math.round(distance) });
      return good;
    }
    function useItem() {
      if ((!boostStock && charge < 3) || !playing || finished) return false;
      if (boostStock) boostStock--; else charge = 0;
      boostUntil = elapsed + 5;
      effects.push({ text: 'STAR TURBO!', until: elapsed + 1.1, color: '#fff27a' });
      onProgress(getState());
      return true;
    }
    function useWeapon(requested) {
      if (!playing || finished) return false;
      const item = requested || heldItem || (missiles ? 'missile' : shields ? 'shield' : '');
      if (!item || (item !== heldItem && !(item === 'missile' && missiles) && !(item === 'shield' && shields))) return false;
      if (item === 'missile') {
        const target = opponents.filter(o => o.distance > distance && o.distance - distance < 220 && !o.finished)
          .sort((a, b) => a.distance - b.distance)[0];
        if (!target) return false;
        missilesInFlight.push({ targetId: target.id, start: elapsed, from: distance, to: target.distance });
      } else if (item === 'banana') {
        bananas.push({ at: distance - 4, lane, owner: 'me', until: elapsed + 14 });
        effects.push({ text: 'BANANA DROP!', until: elapsed + .9, color: '#ffe36c' });
      } else {
        shieldUntil = elapsed + 5;
        effects.push({ text: 'SHIELD!', until: elapsed + .9, color: '#a0f9ff' });
      }
      if (item === heldItem) heldItem = '';
      else if (item === 'missile') missiles--;
      else if (item === 'shield') shields--;
      options.onEvent?.({ kind: item, distance: Math.round(distance) });
      onProgress(getState());
      return true;
    }
    function setOpponents(rows) {
      if (mode !== 'multi') return;
      bananas = rows.filter(row => row.banana).map(row => ({ ...row.banana, owner: row.id, until: elapsed + 1.5 }));
      opponents = rows.filter(row => row.id !== options.playerId).map((row, i) => ({
        id: row.id, name: row.name || `RACER ${i + 1}`, color: row.color || COLORS[(i + 1) % COLORS.length],
        design: row.design || 'teal', kartColor: row.kartColor || 'cyan',
        lane: clamp(Number(row.lane) || 0, -.88, .88), distance: clamp(Number(row.distance) || 0, 0, TOTAL),
        finished: !!row.finished, hit: !!row.hit
      }));
      for (const row of rows) if (row.lastCue?.kind === 'missile') playCue(row.lastCue);
    }
    function getState() {
      const standings = [{ id: options.playerId || 'me', name: options.playerName || '나', distance, elapsed, me: true },
        ...opponents.map(o => ({ id: o.id, name: o.name, distance: o.distance, elapsed: o.elapsed || 0, me: false }))]
        .sort((a, b) => b.distance - a.distance || a.elapsed - b.elapsed);
      return { distance: Math.round(distance), total: TOTAL, speed: Math.round(speed * 3.6), lane: +lane.toFixed(2), obstaclesHit, padsTaken, starsTaken,
        elapsed: +elapsed.toFixed(1), questionRemaining: question ? Math.max(0, Math.ceil(questionDeadline - elapsed)) : null,
        charge, boostStock, missiles, shields, heldItem, correct, asked, rank: standings.findIndex(s => s.me) + 1,
        standings, boosted: elapsed < boostUntil, shielded: elapsed < shieldUntil, finished };
    }
    function resize() {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const scale = Math.min(window.devicePixelRatio || 1, 1.25, Math.sqrt(700000 / Math.max(1, rect.width * rect.height)));
      const w = Math.max(300, Math.round(rect.width * scale));
      const h = Math.max(230, Math.round(rect.height * scale));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      if (size.scale !== scale || size.w !== rect.width || size.h !== rect.height) ctx.setTransform(scale, 0, 0, scale, 0, 0);
      size = { w: rect.width, h: rect.height, scale };
    }
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { resize(); if (!document.hidden && !destroyed) draw(); }) : null;
    observer?.observe(canvas);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibilityChange);
    function onVisibilityChange() { if (!document.hidden && !destroyed) { resize(); draw(); } }
    function trackCenter(at) { return Math.sin(at / 145) * 30 + Math.sin(at / 310) * 18 + Math.sin(at / 68) * 4; }
    function trackSlope(at) { return Math.cos(at / 145) * 30 / 145 + Math.cos(at / 310) * 18 / 310 + Math.cos(at / 68) * 4 / 68; }
    function trackHeight(at) { return Math.sin(at / 105) * 5 + Math.sin(at / 245) * 8; }
    function kart(x, y, size, color, label, player = false, design = 'teal', kartColor = 'cyan', hit = false) {
      const pose = player && lean < -.24 ? 'left' : player && lean > .24 ? 'right' : 'rear';
      const sprite = spriteFor(design, kartColor, pose);
      if (sprite) {
        const width = 118 * size;
        ctx.save(); ctx.translate(x, y); ctx.rotate(player ? -lean * .2 : hit ? Math.sin(elapsed * 34) * .12 : 0);
        ctx.fillStyle = '#091b2a88'; ctx.beginPath(); ctx.ellipse(0, 2, width * .39, width * .11, 0, 0, 7); ctx.fill();
        if (player && elapsed < boostUntil) {
          ctx.fillStyle = '#fff7b0';
          for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * width * .16, -width * .07); ctx.lineTo(side * width * .1, width * .34 + Math.sin(elapsed * 29) * width * .06); ctx.lineTo(side * width * .23, -width * .07); ctx.fill(); }
        }
        ctx.drawImage(sprite, -width / 2, -width * .74 + (Math.sin(elapsed * 31) * Math.min(speed / 40, 1)), width, width);
        if (player && speed > 4) for (const side of [-1, 1]) {
          const wheelX = side * width * .385, wheelY = width * .015, wheelW = width * .105, wheelH = width * .16;
          ctx.save(); ctx.beginPath(); ctx.roundRect(wheelX - wheelW/2, wheelY - wheelH/2, wheelW, wheelH, wheelW*.4); ctx.clip();
          ctx.strokeStyle = '#b9d1d7aa'; ctx.lineWidth = Math.max(1, size * 1.4);
          const offset = distance * .45 % (wheelH / 3);
          for (let n = -1; n < 5; n++) { const yy = wheelY - wheelH/2 + n * wheelH/3 + offset; ctx.beginPath(); ctx.moveTo(wheelX-wheelW*.32, yy); ctx.lineTo(wheelX+wheelW*.32, yy+wheelH*.055); ctx.stroke(); }
          ctx.restore();
        }
        if (player && elapsed < shieldUntil) { ctx.strokeStyle = '#a0f9ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, -width * .24, width * .43, width * .32, 0, 0, 7); ctx.stroke(); }
        ctx.restore();
        if (label) { ctx.fillStyle = '#fff'; ctx.font = `900 ${player ? 13 : 11}px Nunito`; ctx.textAlign = 'center'; ctx.fillText(label, x, y - width * .53); }
        return;
      }
      ctx.save(); ctx.translate(x, y); ctx.rotate(player ? -lean * .2 : 0); ctx.scale(size, size);
      ctx.fillStyle = '#07122188'; ctx.beginPath(); ctx.ellipse(0, 8, 31, 10, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#162338'; ctx.fillRect(-30, -7, 9, 24); ctx.fillRect(21, -7, 9, 24);
      ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(-24, -29, 48, 42, 13); ctx.fill();
      ctx.fillStyle = '#ffffff83'; ctx.beginPath(); ctx.roundRect(-18, -22, 36, 12, 6); ctx.fill();
      ctx.fillStyle = '#17374e'; ctx.beginPath(); ctx.roundRect(-12, -18, 24, 14, 5); ctx.fill();
      ctx.fillStyle = '#fa6569'; ctx.fillRect(-22, 7, 10, 5); ctx.fillRect(12, 7, 10, 5);
      if (player && elapsed < boostUntil) {
        ctx.fillStyle = '#ffe55b';
        for (const dx of [-11, 11]) { ctx.beginPath(); ctx.moveTo(dx - 5, 14); ctx.lineTo(dx, 34 + Math.random() * 14); ctx.lineTo(dx + 5, 14); ctx.fill(); }
      }
      if (player && elapsed < shieldUntil) { ctx.strokeStyle = '#8df6ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -6, 37, 0, 7); ctx.stroke(); }
      ctx.restore();
      if (label) { ctx.fillStyle = '#ffffff'; ctx.font = `900 ${player ? 13 : 11}px Nunito`; ctx.textAlign = 'center'; ctx.fillText(label, x, y - 43 * size); }
    }
    function draw() {
      if (document.hidden || destroyed) return;
      if (!size.w || !size.h) resize();
      const { w, h } = size;
      if (!w || !h) return;
      const boosted = elapsed < boostUntil;
      const horizon = h * (boosted ? .35 : .39);
      const viewDepth = 500;
      const roadPoint = (t, offset = 0) => {
        const ahead = clamp(1 - t, 0, 1) * viewDepth;
        const scale = (boosted ? 36 : 44) / ((boosted ? 36 : 44) + ahead);
        const bend = clamp(trackCenter(distance + ahead) - trackCenter(distance) - trackSlope(distance) * ahead * .4, -34, 34);
        const rise = trackHeight(distance + ahead) - trackHeight(distance);
        const bank = trackSlope(distance + ahead) * h * .05 * scale;
        return {
          x: w * (.5 - lane * .38 * scale + bend * .035 * scale) + offset * (w * (boosted ? .72 : .65) * scale + 4),
          y: horizon + (h - horizon) * scale * 1.05 - rise * h * .012 * (.35 + scale) + offset * bank,
          scale
        };
      };
      if (art.backdrop?.complete && art.backdrop.naturalWidth) {
        ctx.drawImage(art.backdrop, 0, 0, 1024, 230, -lane * w * .025, 0, w * 1.05, horizon);
        const ground = ctx.createLinearGradient(0, horizon, 0, h);
        ground.addColorStop(0, '#82938a'); ground.addColorStop(.45, '#557d71'); ground.addColorStop(1, '#42675f');
        ctx.fillStyle = ground; ctx.fillRect(0, horizon, w, h - horizon);
        ctx.save(); ctx.globalAlpha = .75; ctx.translate(0, distance * 1.4 % 96);
        ctx.fillStyle = grassGrain; ctx.fillRect(0, horizon - 96, w, h - horizon + 96); ctx.restore();
        const fog = ctx.createLinearGradient(0, horizon - 14, 0, horizon + 28);
        fog.addColorStop(0, '#e6b39a00'); fog.addColorStop(.36, '#e6b39a77'); fog.addColorStop(1, '#e6b39a00');
        ctx.fillStyle = fog; ctx.fillRect(0, horizon - 14, w, 42);
      }
      else {
        const sky = ctx.createLinearGradient(0, 0, 0, horizon);
        sky.addColorStop(0, '#214b83'); sky.addColorStop(1, '#79c9d5');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, w, horizon);
        ctx.fillStyle = '#aee9cd'; ctx.beginPath(); ctx.arc(w * .79, h * .15, 20, 0, 7); ctx.fill();
        ctx.fillStyle = '#3e8f82';
        for (let x = -40; x < w + 100; x += 90) { const peak = 20 + (Math.sin(x * .13) + 1) * 9; ctx.beginPath(); ctx.moveTo(x - 60, horizon); ctx.lineTo(x + 80, horizon); ctx.fill(); }
        ctx.fillStyle = '#258a71'; ctx.fillRect(0, horizon, w, h - horizon);
      }
      function ribbon(extra) {
        ctx.beginPath();
        for (let i = 0; i <= 36; i++) { const p = roadPoint(i / 36, -1 - extra); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
        for (let i = 36; i >= 0; i--) { const p = roadPoint(i / 36, 1 + extra); ctx.lineTo(p.x, p.y); }
        ctx.closePath();
      }
      const shoulder = ctx.createLinearGradient(0, horizon, 0, h);
      shoulder.addColorStop(0, '#9b8b78'); shoulder.addColorStop(.6, '#777969'); shoulder.addColorStop(1, '#4c6965');
      ribbon(.07); ctx.fillStyle = shoulder; ctx.fill();
      const asphalt = ctx.createLinearGradient(0, horizon, 0, h);
      asphalt.addColorStop(0, '#303e4a'); asphalt.addColorStop(.45, '#414b53'); asphalt.addColorStop(1, '#50545a');
      ribbon(0); ctx.fillStyle = asphalt; ctx.fill();
      ctx.save(); ribbon(0); ctx.clip();
      ctx.translate(0, distance * 2.4 % 96); ctx.fillStyle = asphaltGrain;
      ctx.fillRect(-w, horizon - 96, w * 3, h - horizon + 96);
      ctx.restore();
      ctx.save(); ribbon(0); ctx.clip();
      const crown = ctx.createLinearGradient(0, 0, w, 0);
      crown.addColorStop(0, '#101d2a44'); crown.addColorStop(.35, '#ffffff09');
      crown.addColorStop(.65, '#ffffff0c'); crown.addColorStop(1, '#101d2a44');
      ctx.fillStyle = crown; ctx.fillRect(0, horizon, w, h - horizon); ctx.restore();
      for (const side of [-1, 1]) {
        ctx.beginPath();
        for (let i = 0; i <= 36; i++) { const p = roadPoint(i / 36, side); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
        ctx.strokeStyle = '#e4c5a3'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
      }
      const markStart = Math.floor(distance / 24) * 24;
      for (let mark = markStart; mark < distance + viewDepth; mark += 24) {
        const delta = mark - distance;
        if (delta < 0 || delta > viewDepth) continue;
        const t1 = 1 - delta / viewDepth, t2 = 1 - Math.min(viewDepth, delta + 11) / viewDepth;
        for (const side of [-1, 1]) {
          const a = roadPoint(t1, side), b = roadPoint(t2, side);
          ctx.strokeStyle = Math.floor(mark / 24) % 2 ? '#f3d4ac' : '#d5796e';
          ctx.lineWidth = 1 + a.scale * 9; ctx.lineCap = 'butt';
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        if (Math.floor(mark / 24) % 2 === 0) for (const line of [-1 / 3, 1 / 3]) {
          const a = roadPoint(t1, line), b = roadPoint(t2, line);
          ctx.strokeStyle = '#f4e7c383'; ctx.lineWidth = .5 + a.scale * 3;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      // Continuous rails follow the projected bends; sparse posts make speed visible.
      for (const side of [-1, 1]) {
        for (const [lift, shade, width] of [[7, '#243b45', 6], [12, '#c6c5ad', 3]]) {
          ctx.beginPath();
          for (let i = 0; i <= 36; i++) {
            const t = i / 36, p = roadPoint(t, side * 1.12);
            const y = p.y - lift * (.2 + p.scale * 1.3);
            i ? ctx.lineTo(p.x, y) : ctx.moveTo(p.x, y);
          }
          ctx.lineWidth = width; ctx.strokeStyle = shade; ctx.lineJoin = 'round'; ctx.stroke();
        }
      }
      const postStart = Math.floor(distance / 32) * 32;
      for (let at = postStart; at < distance + viewDepth; at += 32) {
        const delta = at - distance; if (delta < 0) continue;
        const t = 1 - delta / viewDepth;
        for (const side of [-1, 1]) {
          const p = roadPoint(t, side * 1.12), tall = 3 + p.scale * 15;
          ctx.strokeStyle = '#283d45'; ctx.lineWidth = 1 + p.scale * 3;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - tall); ctx.stroke();
        }
      }
      // Roadside props move through the same perspective as the road, far to near.
      if (art.roadside?.complete && art.roadside.naturalWidth) {
        const first = Math.floor((distance + viewDepth) / 42) * 42;
        for (let at = first; at >= distance - 15; at -= 42) {
          const t = clamp(1 - (at - distance) / viewDepth, 0, 1.05);
          if (t <= 0 || t > 1.05) continue;
          const p = roadPoint(t), slot = Math.floor(at / 42) % 6;
          for (const side of [-1, 1]) {
            const kind = slot === 0 ? 1 : slot === 1 ? 0 : slot === 2 ? (side < 0 ? 2 : 1) : slot === 3 ? 0 : slot === 4 ? (side > 0 ? 3 : 1) : 4;
            const width = (kind === 0 ? 150 : kind === 1 ? 130 : 105) * p.scale;
            const height = width * (kind === 2 ? 1.3 : kind === 0 ? .72 : 1);
            const x = roadPoint(t, side * 1.26).x + side * width * .35;
            ctx.drawImage(art.roadside, kind * 256, 0, 256, 256, x - width / 2, p.y - height * .8, width, height);
          }
        }
      }
      for (const event of COURSE) {
        const delta = event.at - distance;
        if (delta < -18 || delta > viewDepth) continue;
        const t = clamp(1 - delta / viewDepth, 0, 1.04), p = roadPoint(t, event.lane * .65), y = p.y;
        if (y < horizon || y > h) continue;
        const x = p.x;
        if (art.obstacles?.complete && art.obstacles.naturalWidth && ['cone','box','banana'].includes(event.kind)) {
          const cell = event.kind === 'cone' ? 0 : event.kind === 'box' ? 1 : 2;
          const width = (event.kind === 'box' ? 90 : event.kind === 'banana' ? 68 : 72) * p.scale;
          ctx.fillStyle = '#081d2880'; ctx.beginPath(); ctx.ellipse(x, y, width*.4, width*.105, 0, 0, 7); ctx.fill();
          ctx.drawImage(art.obstacles, cell*192, 0, 192, 192, x-width/2, y-width*([171,164,164][cell]/192), width, width);
          continue;
        }
        ctx.textAlign = 'center'; ctx.font = `${Math.max(10, 47 * p.scale)}px sans-serif`;
        ctx.fillStyle = event.kind === 'cone' ? '#f66a60' : event.kind === 'pad' ? '#79edfc' : '#ffe673';
        if (event.kind === 'pad') { ctx.fillRect(x - 18*p.scale, y - 5*p.scale, 36*p.scale, 10*p.scale); ctx.fillStyle = '#113c5b'; ctx.fillText('»', x, y + 3*p.scale); }
        else ctx.fillText(event.kind === 'cone' ? '▲' : event.kind === 'box' ? '▣' : '★', x, y);
      }
      for (const banana of bananas) {
        const delta = banana.at - distance, t = clamp(1 - delta / viewDepth, 0, 1.04);
        if (delta < -20 || delta > viewDepth) continue;
        const p = roadPoint(t, banana.lane * .65);
        if (art.obstacles?.complete && art.obstacles.naturalWidth) {
          const width = 68*p.scale;
          ctx.fillStyle = '#081d2880'; ctx.beginPath(); ctx.ellipse(p.x,p.y,width*.4,width*.1,0,0,7); ctx.fill();
          ctx.drawImage(art.obstacles, 384, 0, 192, 192, p.x-width/2,p.y-width*164/192,width,width);
        } else { ctx.textAlign = 'center'; ctx.font = `${Math.max(11, 38*p.scale)}px sans-serif`; ctx.fillText('🍌', p.x, p.y); }
      }
      for (const shot of missilesInFlight) {
        const target = opponents.find(o => o.id === shot.targetId);
        if (!target) continue;
        const flight = clamp((elapsed-shot.start)/.72,0,1);
        const ahead = 12 + (Math.max(45, target.distance-distance) - 12) * flight;
        const p = roadPoint(1-ahead/viewDepth, target.lane*.65*flight), width = (65+flight*20)*p.scale;
        ctx.save(); ctx.translate(p.x,p.y-width*.3); ctx.rotate(-Math.PI/2);
        if (art.items?.complete && art.items.naturalWidth) ctx.drawImage(art.items, 256,0,128,128,-width/2,-width/2,width,width);
        else { ctx.fillStyle='#ffcf63'; ctx.fillRect(-width/2,-width/4,width,width/2); }
        ctx.restore();
        ctx.strokeStyle = '#ffda89aa'; ctx.lineWidth = Math.max(1,width*.13); ctx.beginPath(); ctx.moveTo(p.x,p.y+width*.1); ctx.lineTo(p.x,p.y+width*.9); ctx.stroke();
      }
      for (const impact of impacts) {
        const delta = impact.targetId ? Math.max(45, impact.at-distance) : impact.at-distance;
        const p=roadPoint(1-delta/viewDepth, impact.lane*.65), life=clamp((impact.until-elapsed)/.55,0,1), width=170*p.scale*(1.3-life*.3);
        if (delta < -10 || delta > viewDepth) continue;
        ctx.save(); ctx.globalAlpha=life;
        if (art.items?.complete && art.items.naturalWidth) ctx.drawImage(art.items,512,0,128,128,p.x-width/2,p.y-width*.85,width,width);
        else { ctx.fillStyle='#ffb863';ctx.beginPath();ctx.arc(p.x,p.y-width*.3,width*.4,0,7);ctx.fill(); }
        ctx.strokeStyle='#fff5c9'; ctx.lineWidth=Math.max(2,3*p.scale); ctx.beginPath();
        ctx.ellipse(p.x,p.y-width*.33,width*(.22+(1-life)*.13),width*(.16+(1-life)*.08),0,0,7);ctx.stroke();
        ctx.restore();
      }
      if (distance > TOTAL - 100) {
        const p = roadPoint(1 - (TOTAL - distance) / viewDepth), y = p.y, width = w * p.scale * 1.3;
        if (y < h) { ctx.fillStyle = '#fff'; ctx.fillRect(p.x - width / 2, y, width, Math.max(5,p.scale*12)); ctx.fillStyle = '#17263a'; for(let x=0;x<12;x+=2)ctx.fillRect(p.x-width/2+x*width/12,y,width/12,Math.max(5,p.scale*12)/2); }
      }
      const targetIds = new Set([...missilesInFlight.map(shot => shot.targetId), ...impacts.map(impact => impact.targetId)]);
      const visible = opponents.filter(o => (o.distance - distance > (w < 500 ? 36 : 28) || targetIds.has(o.id)) && o.distance - distance < viewDepth)
        .sort((a,b) => Math.abs(a.distance-distance) - Math.abs(b.distance-distance)).slice(0, w < 500 ? 3 : 6)
        .sort((a,b) => b.distance - a.distance);
      for (const o of visible) {
        const delta = targetIds.has(o.id) ? Math.max(45, o.distance-distance) : o.distance-distance;
        const p = roadPoint(1 - delta / viewDepth, o.lane * .65);
        if (p.y > horizon + 10 && p.y < h * .82) kart(p.x, p.y, .12 + p.scale * .98, o.color, o.name,
          false, o.design, o.kartColor, o.hit || elapsed < (o.hitUntil || 0));
      }
      const py = h * .88;
      const px = roadPoint(1, lane * .65).x + (elapsed < slipUntil ? Math.sin(elapsed * 22) * w * .016 : 0);
      if (Math.abs(lean) > .3 && speed > 14) {
        ctx.strokeStyle = '#172b3199'; ctx.lineWidth = Math.max(2, w / 450);
        for (const side of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(px + side * w * .024, py + h * .012);
          ctx.lineTo(px + side * w * .03 - lean * w * .014, py + h * .085); ctx.stroke();
        }
        ctx.fillStyle = '#d9a89a88';
        for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(px + side * w * .04 - lean * w * .02, py + h * .08, 3 + (Math.sin(elapsed * 18 + side) + 1) * 2, 0, 7); ctx.fill(); }
      }
      kart(px, py, clamp(w / 600, 1.05, 2), COLORS[0], options.playerName || '나', true, options.kartDesign, options.kartColor);
      if (boosted) {
        ctx.strokeStyle = '#dbfaff99'; ctx.lineWidth = 2;
        for (let i = 0; i < 10; i++) {
          const side = i % 2 ? 1 : -1, phase = ((i * 131 + distance * 8) % 800) / 800;
          const y = horizon + phase * phase * (h - horizon), x = w * .5 + side * (w * (.2 + phase * .32));
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + side * (4 + phase * 8), y + 12 + phase * 35); ctx.stroke();
        }
      }
      if (elapsed < hitUntil || elapsed < slipUntil) {
        ctx.fillStyle = elapsed < slipUntil ? '#ffe69a19' : '#ff706319'; ctx.fillRect(0,0,w,h);
      }
      for (const fx of effects) { const life = (fx.until - elapsed) / .9; ctx.globalAlpha = clamp(life, 0, 1); ctx.fillStyle = fx.color; ctx.font = `900 ${Math.min(32,w/14)}px 'Black Han Sans'`; ctx.textAlign = 'center'; ctx.fillText(fx.text, w/2, h*.45 - (1-life)*35); ctx.globalAlpha = 1; }
    }
    function updateProjectiles() {
      for (const shot of missilesInFlight) if (elapsed-shot.start >= .72) {
        const target=opponents.find(o=>o.id===shot.targetId);
        if (target) { if (!shot.visualOnly) { target.slowUntil=elapsed+2.5;target.hitUntil=elapsed+1.6; }
          impacts.push({at:target.distance,lane:target.lane,targetId:target.id,until:elapsed+.55});
          effects.push({text:`${target.name} HIT!`,until:elapsed+.9,color:'#ffb693'}); }
      }
      missilesInFlight=missilesInFlight.filter(shot=>elapsed-shot.start<.72);
      impacts=impacts.filter(impact=>impact.until>elapsed);
      bananas=bananas.filter(b=>b.until>elapsed);
    }
    function frame(now) {
      if (!playing) return;
      if (now - drawnAt < 30) { raf = requestAnimationFrame(frame); return; }
      drawnAt = now;
      const dt = Math.min(.05, (now - previous) / 1000 || 0); previous = now; elapsed += dt;
      const oldLane = lane;
      lane = clamp(lane + steer * dt * 1.28 * (elapsed < slipUntil ? .45 : 1) +
        (elapsed < slipUntil ? Math.sin(elapsed * 27) * dt * .28 : 0), -.88, .88);
      lean += (steer - lean) * Math.min(1, dt * 7);
      if (speed > 14 && Math.abs(steer) > .5 && elapsed >= slipUntil) {
        driftTime += dt;
        if (driftTime >= .45 && driftTime - dt < .45) options.onEvent?.({ kind: 'drift', distance: Math.round(distance) });
        if (driftTime >= .45) charge = Math.min(3, charge + dt * .22);
      } else driftTime = 0;
      const offRoad = Math.abs(lane) > .79 && elapsed >= shieldUntil;
      if (offRoad && !wasOffRoad) { effects.push({ text: '노견! 감속', until: elapsed + .8, color: '#ffda9b' }); options.onEvent?.({ kind: 'offroad', distance: Math.round(distance) }); }
      wasOffRoad = offRoad;
      if (mode === 'multi') {
        if (!finished) distance = Math.min(TOTAL, distance + speed * dt);
        updateProjectiles();
        if (elapsed - progressAt > .2) { progressAt = elapsed; onProgress(getState()); }
        effects = effects.filter(fx => fx.until > elapsed);
        if (!document.hidden) draw(); raf = requestAnimationFrame(frame); return;
      }
      const target = elapsed < slowUntil ? 11 : elapsed < boostUntil ? 32 : elapsed < draftUntil ? 25.5 : 23;
      speed += (target - speed) * Math.min(1, dt * 2.3);
      if (speed > 14 && Math.abs(lean) > .3) charge = Math.min(3, charge + Math.abs(lane - oldLane) * .45);
      const before = distance;
      distance = Math.min(TOTAL, distance + speed * (offRoad ? .66 : 1) * dt);
      for (const event of COURSE) {
        if (event.at <= before || event.at > distance || Math.abs(lane - event.lane) > (event.kind === 'box' ? .36 : .28)) continue;
        if ((event.kind === 'cone' || event.kind === 'banana') && elapsed >= hitUntil && elapsed >= shieldUntil) {
          obstaclesHit++; hitUntil = elapsed + 1.4; slowUntil = Math.max(slowUntil, elapsed + 2.1);
          if (event.kind === 'banana') slipUntil = elapsed + 1.7;
          effects.push({ text: event.kind === 'banana' ? '미끄러짐!' : '충돌! 속도 감소', until: elapsed + .9, color: '#ffaaa4' });
          options.onEvent?.({ kind: event.kind === 'banana' ? 'banana_hit' : 'hit', distance: event.at });
        } else if (event.kind === 'pad') {
          padsTaken++; boostUntil = Math.max(boostUntil, elapsed) + 1.6;
          effects.push({ text: 'SPEED PAD!', until: elapsed + .9, color: '#8bf2ff' });
          options.onEvent?.({ kind: 'pad', distance: event.at });
        } else if (event.kind === 'star') {
          starsTaken++; charge = Math.min(3, charge + 1);
          effects.push({ text: 'STAR +1', until: elapsed + .9, color: '#ffe36c' });
          options.onEvent?.({ kind: 'star', distance: event.at });
        } else if (event.kind === 'box' && !heldItem) {
          heldItem = 'banana';
          effects.push({ text: `${heldItem.toUpperCase()}!`, until: elapsed + .9, color: '#ffe36c' });
          options.onEvent?.({ kind: 'box', item: heldItem, distance: event.at });
        }
      }
      if (mode === 'solo') for (const o of ai) {
        const old = o.distance;
        o.distance = Math.min(TOTAL, o.distance + (elapsed < (o.slowUntil || 0) ? 10 : o.base + Math.sin(elapsed * o.wobble + o.base) * 1.2) * dt);
        for (const banana of bananas) if (banana.owner !== o.id && banana.at > old && banana.at <= o.distance && Math.abs(o.lane - banana.lane) < .3 && elapsed >= (o.hitUntil || 0)) {
          o.slowUntil = elapsed + 2.5; o.hitUntil = elapsed + 1.7; banana.until = 0;
          effects.push({ text: `${o.name} 미끄러짐!`, until: elapsed + .9, color: '#ffe36c' });
        }
        for (const event of COURSE) if (event.kind === 'banana' && event.at > old && event.at <= o.distance && Math.abs(o.lane-event.lane)<.3 && elapsed >= (o.hitUntil||0)) {
          o.slowUntil=elapsed+2.5; o.hitUntil=elapsed+1.7;
        }
        if (distance > 40 && Math.abs(o.distance-distance) < 3.5 && Math.abs(o.lane-lane) < .18 &&
          (Math.abs(o.distance-distance) >= .8 || Math.abs(lane-oldLane) > .015) && elapsed >= hitUntil && elapsed >= (o.hitUntil || 0)) {
          hitUntil=elapsed+1.1; slipUntil=elapsed+.7; slowUntil=Math.max(slowUntil,elapsed+1.1);
          lane=clamp(lane+(o.lane<=lane ? .11 : -.11),-.88,.88);
          o.hitUntil=elapsed+1.1; o.slowUntil=elapsed+1.1;
          effects.push({text:'카트 충돌!',until:elapsed+.9,color:'#ffb69c'});
          options.onEvent?.({kind:'contact',distance:Math.round(distance),target:o.id});
        }
      }
      const slipstream = ai.some(o => o.distance-distance > 9 && o.distance-distance < 48 && Math.abs(o.lane-lane) < .2);
      draftTime = slipstream ? draftTime + dt : 0;
      if (draftTime > 1.5) draftUntil = elapsed + .5;
      updateProjectiles();
      if (!question && questionIndex < QUESTION_MARKS.length && distance >= QUESTION_MARKS[questionIndex]) {
        questionIndex++; nextQuestion();
      }
      if (question && elapsed >= questionDeadline) answer('');
      if (elapsed - progressAt > .2) { progressAt = elapsed; onProgress(getState()); }
      effects = effects.filter(fx => fx.until > elapsed);
      if (!document.hidden) draw();
      if (distance >= TOTAL) {
        finished = true; playing = false;
        const state = getState(); onFinish(state); return;
      }
      raf = requestAnimationFrame(frame);
    }
    function start() { if (playing || finished) return; shuffle(); playing = true; previous = performance.now(); draw(); raf = requestAnimationFrame(frame); }
    function stop() { playing = false; cancelAnimationFrame(raf); }
    function destroy() { stop(); destroyed = true; observer?.disconnect(); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVisibilityChange); }
    function setSteer(value) { steer = clamp(value, -1, 1); }
    function setProgress(value) { distance = clamp(Number(value) || 0, 0, TOTAL); draw(); }
    function setRemoteState(kart) {
      if (!kart) return;
      if (!remoteInitialized) { lane = clamp(Number(kart.lane) || 0, -.88, .88); remoteInitialized = true; }
      distance = clamp(Number(kart.distance) || 0, 0, TOTAL);
      speed = Math.max(0, (Number(kart.speed) || 0) / 3.6);
      charge = clamp(Number(kart.charge) || 0, 0, 3);
      boostStock = Math.max(0, Number(kart.boostStock) || 0);
      missiles = Math.max(0, Number(kart.missiles) || 0);
      shields = Math.max(0, Number(kart.shields) || 0);
      heldItem = kart.heldItem || '';
      boostUntil = kart.boosted ? elapsed + 1.2 : 0;
      shieldUntil = kart.shielded ? elapsed + 1.2 : 0;
      slipUntil = kart.slipping ? elapsed + 1.2 : 0;
      hitUntil = kart.hit ? elapsed + 1.1 : 0;
      if (kart.lastCue?.kind !== 'missile') playCue(kart.lastCue);
      finished = Boolean(kart.finishedAt);
      if (kart.finishedAt) speed = 0;
      draw();
    }
    function playCue(cue) {
      if (!cue?.kind || !Number.isFinite(cue.at)) return;
      const key = `${cue.from || options.playerId || 'me'}:${cue.kind}:${cue.at}`;
      if (seenCues.has(key)) return;
      seenCues.add(key);
      if (seenCues.size > 40) seenCues = new Set([key]);
      if (cue.kind === 'missile' && cue.target) {
        const target = opponents.find(o => o.id === cue.target);
        if (target) missilesInFlight.push({ targetId: target.id, start: elapsed, from: distance, to: target.distance, visualOnly: true });
      }
      if (cue.kind === 'missile_hit' || cue.kind === 'shield_block' || cue.kind === 'banana_hit' || cue.kind === 'contact') {
        impacts.push({ at: distance + 12, lane, until: elapsed + .55 });
        hitUntil = Math.max(hitUntil, elapsed + .7);
        if (cue.kind === 'banana_hit' || cue.kind === 'contact') slipUntil = Math.max(slipUntil, elapsed + .9);
      }
    }
    return { start, stop, destroy, answer, useItem, useWeapon, setSteer, setOpponents, setProgress, setRemoteState, playCue, getState, draw, get question() { return question; } };
  }
  window.GrammarKart = { createRace: makeRace, paintPreview, paintShowcase, distance: TOTAL, course: COURSE };
})();
