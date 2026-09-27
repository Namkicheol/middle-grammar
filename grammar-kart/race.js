/* Shared race surface for solo and classroom rooms. No network assumptions here. */
(function () {
  'use strict';
  const art = {};
  const KART_PAINT = { cyan: '#35d6dc', coral: '#f65b65', gold: '#ffd04e', violet: '#a879ed', lime: '#94db64', pink: '#ef8bc0' };
  if (typeof Image !== 'undefined') {
    for (const [key, file] of Object.entries({ backdrop: 'neon-circuit-bg.webp', teal: 'kart-rear-teal.webp', red: 'kart-rear-red.webp', yellow: 'kart-rear-yellow.webp' })) {
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
  if (typeof document !== 'undefined') {
    art.trees = [0, 1].map(kind => {
      const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 132;
      const c = canvas.getContext('2d');
      c.fillStyle = '#39445055'; c.beginPath(); c.ellipse(48, 122, 34, 6, 0, 0, 7); c.fill();
      c.fillStyle = '#64535c'; c.beginPath(); c.moveTo(41, 121); c.lineTo(39, 61); c.lineTo(55, 56); c.lineTo(53, 121); c.fill();
      c.fillStyle = kind ? '#326a68' : '#337f6d';
      for (const [x, y, r] of (kind ? [[33,58,27],[62,59,24],[48,38,29]] : [[29,65,24],[64,63,25],[46,43,30]])) {
        c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
      }
      c.fillStyle = kind ? '#7fb59a' : '#94b897';
      c.beginPath(); c.ellipse(kind ? 31 : 28, 42, 12, 6, -.45, 0, 7); c.fill();
      c.fillStyle = '#ffd394'; c.beginPath(); c.arc(kind ? 70 : 68, 51, 3, 0, 7); c.fill();
      return canvas;
    });
  }
  const TOTAL = 1800;
  const COLORS = ['#ffce51', '#f66a60', '#69def0', '#b79aff', '#8ee47e', '#ff9ccb'];
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const norm = s => String(s).trim().toLowerCase().replace(/[.!?\s]+/g, '');
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
      { at: base + 68, lane: i % 2 ? .55 : -.55, kind: 'box' }
    ];
  }).flat();

  function makeRace(options) {
    const { canvas, lesson, mode = 'solo', onProgress = () => {}, onAnswer = () => {}, onFinish = () => {}, onQuestion = () => {} } = options;
    const ctx = canvas.getContext('2d');
    const pool = ((typeof GAME_QUESTIONS !== 'undefined' && GAME_QUESTIONS[lesson]?.questions) || [])
      .filter(q => Array.isArray(q.opts) && q.opts.length === 4 && q.opts.some(o => norm(o) === norm(q.ans)));
    let deck = [];
    let deckIndex = 0;
    let raf = 0;
    let previous = 0;
    let elapsed = 0;
    let questionAt = 3.5;
    let question = null;
    let questionDeadline = 0;
    let playing = false;
    let finished = false;
    let steer = 0;
    let lean = 0;
    let lane = 0;
    let distance = 0;
    let speed = 0;
    let boostUntil = 0;
    let slowUntil = 0;
    let shieldUntil = 0;
    let slipUntil = 0;
    let charge = 0;
    let heldItem = '';
    let bananas = [];
    let itemCount = 0;
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
    const ai = [
      { id: 'comet', name: '코멧', color: COLORS[1], design: 'red', kartColor: 'coral', base: 21.5, wobble: .19, distance: 0, lane: -.5 },
      { id: 'bolt', name: '볼트', color: COLORS[2], design: 'yellow', kartColor: 'gold', base: 22.7, wobble: .29, distance: 0, lane: .5 },
      { id: 'nova', name: '노바', color: COLORS[3], design: 'teal', kartColor: 'violet', base: 20.9, wobble: .37, distance: 0, lane: 0 }
    ];
    if (mode === 'solo') opponents = ai;

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
      questionDeadline = elapsed + 10;
      asked++;
      onQuestion({ question, number: asked, seconds: 10 });
    }
    function answer(choice) {
      if (!question || finished) return false;
      const q = question;
      const good = norm(choice) === norm(q.ans);
      question = null;
      questionAt = elapsed + 3.7;
      if (good) {
        correct++;
        combos++;
        boostUntil = Math.max(boostUntil, elapsed) + 2.8;
        charge = Math.min(3, charge + 1);
        effects.push({ text: combos >= 2 ? `${combos} COMBO!` : 'BOOST!', until: elapsed + .9, color: '#ffe36c' });
      } else {
        combos = 0;
        slowUntil = elapsed + 1.8;
        effects.push({ text: '다시 달려!', until: elapsed + .9, color: '#ffafaa' });
      }
      onAnswer({ questionId: q.id, choice, correct: good, answer: q.ans, charge, correctCount: correct, asked, distance: Math.round(distance) });
      return good;
    }
    function useItem() {
      if (charge < 3 || !playing || finished) return false;
      charge = 0;
      shieldUntil = elapsed + 5;
      boostUntil = Math.max(boostUntil, elapsed) + 5;
      effects.push({ text: 'STAR TURBO!', until: elapsed + 1.1, color: '#fff27a' });
      onProgress(getState());
      return true;
    }
    function useWeapon() {
      if (!heldItem || !playing || finished) return false;
      const item = heldItem;
      if (item === 'missile') {
        const target = opponents.filter(o => o.distance > distance && o.distance - distance < 220 && !o.finished)
          .sort((a, b) => a.distance - b.distance)[0];
        if (!target) return false;
        target.slowUntil = elapsed + 2.5; target.hitUntil = elapsed + 1.6;
        effects.push({ text: `${target.name} HIT!`, until: elapsed + .9, color: '#ffb693' });
      } else if (item === 'banana') {
        bananas.push({ at: distance - 4, lane, owner: 'me', until: elapsed + 14 });
        effects.push({ text: 'BANANA DROP!', until: elapsed + .9, color: '#ffe36c' });
      } else {
        shieldUntil = elapsed + 5;
        effects.push({ text: 'SHIELD!', until: elapsed + .9, color: '#a0f9ff' });
      }
      heldItem = '';
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
        lane: clamp(Number(row.lane) || 0, -.88, .88), distance: clamp(Number(row.distance) || 0, 0, TOTAL), finished: !!row.finished
      }));
    }
    function getState() {
      const standings = [{ id: options.playerId || 'me', name: options.playerName || '나', distance, elapsed, me: true },
        ...opponents.map(o => ({ id: o.id, name: o.name, distance: o.distance, elapsed: o.elapsed || 0, me: false }))]
        .sort((a, b) => b.distance - a.distance || a.elapsed - b.elapsed);
      return { distance: Math.round(distance), total: TOTAL, speed: Math.round(speed * 3.6), lane: +lane.toFixed(2), obstaclesHit, padsTaken, starsTaken,
        elapsed: +elapsed.toFixed(1), questionRemaining: question ? Math.max(0, Math.ceil(questionDeadline - elapsed)) : null,
        charge, heldItem, correct, asked, rank: standings.findIndex(s => s.me) + 1,
        standings, boosted: elapsed < boostUntil, shielded: elapsed < shieldUntil, finished };
    }
    function resize() {
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 1.25, Math.sqrt(700000 / Math.max(1, rect.width * rect.height)));
      const w = Math.max(300, Math.round(rect.width * scale));
      const h = Math.max(230, Math.round(rect.height * scale));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      return { w: rect.width, h: rect.height };
    }
    function roadX(y, h, w) {
      const horizon = h * .33;
      const t = clamp((y - horizon) / (h - horizon), 0, 1);
      const bend = Math.sin(distance / 125 + (1 - t) * 2.7) * .12 * (1 - t * .65);
      return w * (.5 + bend - lane * .11);
    }
    function kart(x, y, size, color, label, player = false, design = 'teal', kartColor = 'cyan') {
      const pose = player && lean < -.24 ? 'left' : player && lean > .24 ? 'right' : 'rear';
      const sprite = spriteFor(design, kartColor, pose);
      if (sprite) {
        const width = 118 * size;
        ctx.save(); ctx.translate(x, y); ctx.rotate(player ? -lean * .2 : 0);
        ctx.fillStyle = '#091b2a88'; ctx.beginPath(); ctx.ellipse(0, 2, width * .39, width * .11, 0, 0, 7); ctx.fill();
        if (player && elapsed < boostUntil) {
          ctx.fillStyle = '#fff7b0';
          for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * width * .16, -width * .07); ctx.lineTo(side * width * .1, width * .34 + Math.sin(elapsed * 29) * width * .06); ctx.lineTo(side * width * .23, -width * .07); ctx.fill(); }
        }
        ctx.drawImage(sprite, -width / 2, -width * .74 + (Math.sin(elapsed * 31) * Math.min(speed / 40, 1)), width, width);
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
      const { w, h } = resize();
      const boosted = elapsed < boostUntil;
      const horizon = h * (boosted ? .3 : .33);
      const widen = boosted ? 1.09 : 1;
      const roadY = t => horizon + (h - horizon) * t * t + Math.sin(distance / 170 + (1 - t) * 5) * h * .028 * t * (1 - t);
      const roadHalf = t => (46 + t * t * w * .47) * widen;
      if (art.backdrop?.complete && art.backdrop.naturalWidth) {
        ctx.drawImage(art.backdrop, 0, 0, 1024, 230, -lane * w * .025, 0, w * 1.05, horizon);
        ctx.fillStyle = '#417f73'; ctx.fillRect(0, horizon, w, h - horizon);
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
      for (let i = 0; i < 45; i++) {
        const t = i / 44, y = roadY(t), half = roadHalf(t), cx = roadX(y, h, w);
        const nextT = (i + 1) / 44, ny = roadY(nextT) + 2, nhalf = roadHalf(nextT), ncx = roadX(ny, h, w);
        ctx.fillStyle = (Math.floor((distance / 3 + i) / 3) % 2) ? '#424b56' : '#48515b';
        ctx.beginPath(); ctx.moveTo(cx - half, y); ctx.lineTo(cx + half, y); ctx.lineTo(ncx + nhalf, ny); ctx.lineTo(ncx - nhalf, ny); ctx.fill();
        ctx.fillStyle = (Math.floor((distance / 3 + i) / 2) % 2) ? '#fff2cd' : '#e76c60';
        const edge = Math.max(4, t * 13); ctx.fillRect(cx - half, y, edge, ny - y + 2); ctx.fillRect(cx + half - edge, y, edge, ny - y + 2);
        if (Math.floor(distance / 3 + i) % 8 < 4) {
          ctx.fillStyle = '#ffedab'; const ww = Math.max(2, t * 5); ctx.fillRect(cx - half / 3 - ww / 2, y, ww, ny - y + 2); ctx.fillRect(cx + half / 3 - ww / 2, y, ww, ny - y + 2);
        }
      }
      // Trees and lights advance with the road so speed remains visible.
      for (let i = 0; i < 13; i++) {
        const t = ((i * 89 + distance * 11) % 980) / 980, y = roadY(t), cx = roadX(y, h, w), half = roadHalf(t);
        for (const side of [-1, 1]) {
          const x = cx + side * (half + 14 + t * 28), tw = 10 + t * t * 78, th = tw * 1.38;
          if (art.trees?.length) ctx.drawImage(art.trees[(i + (side > 0 ? 1 : 0)) % 2], x - tw / 2, y - th, tw, th);
        }
      }
      for (const event of COURSE) {
        const delta = event.at - distance;
        if (delta < -18 || delta > 310) continue;
        const t = clamp(1 - delta / 350, .1, 1.04), y = roadY(t);
        if (y < horizon || y > h) continue;
        const half = roadHalf(t), x = roadX(y, h, w) + event.lane * half * .65;
        ctx.textAlign = 'center'; ctx.font = `${Math.max(10, 47 * t * t)}px sans-serif`;
        ctx.fillStyle = event.kind === 'cone' ? '#f66a60' : event.kind === 'pad' ? '#79edfc' : '#ffe673';
        if (event.kind === 'pad') { ctx.fillRect(x - 17*t, y - 5*t, 34*t, 10*t); ctx.fillStyle = '#113c5b'; ctx.fillText('»', x, y + 3*t); }
        else ctx.fillText(event.kind === 'cone' ? '▲' : event.kind === 'box' ? '▣' : '★', x, y);
      }
      for (const banana of bananas) {
        const delta = banana.at - distance, t = clamp(1 - delta / 350, .1, 1.04);
        if (delta < -20 || delta > 310) continue;
        const y = roadY(t), x = roadX(y,h,w) + banana.lane * roadHalf(t) * .65;
        ctx.textAlign = 'center'; ctx.font = `${Math.max(11, 38*t*t)}px sans-serif`; ctx.fillText('🍌', x, y);
      }
      if (distance > TOTAL - 100) {
        const t = clamp((100 - (TOTAL - distance)) / 100, 0, 1), y = horizon + (h - horizon) * t * t;
        if (y < h) { ctx.fillStyle = '#fff'; ctx.fillRect(roadX(y,h,w) - (55 + t*w*.42), y, 110 + t*w*.84, Math.max(5,t*12)); ctx.fillStyle = '#17263a'; for(let x=0;x<12;x+=2)ctx.fillRect(roadX(y,h,w)-(55+t*w*.42)+x*(110+t*w*.84)/12,y,(110+t*w*.84)/12,Math.max(5,t*12)/2); }
      }
      const visible = opponents.filter(o => o.distance >= distance - 8 && o.distance - distance < 280 &&
        !(o.distance - distance < 25 && Math.abs(o.lane - lane) < .3))
        .sort((a,b) => Math.abs(a.distance-distance) - Math.abs(b.distance-distance)).slice(0, 8)
        .sort((a,b) => b.distance - a.distance);
      for (const o of visible) {
        const delta = o.distance - distance, t = clamp(1 - delta / 350, .12, 1.16), y = roadY(t), half = roadHalf(t);
        const label = Math.abs(delta) < 28 && Math.abs(o.lane - lane) < .3 ? '' : o.name;
        if (y > horizon + 10 && y < h + 30) kart(roadX(y,h,w) + o.lane * half * .65, y, .28 + t * .86, o.color, label, false, o.design, o.kartColor);
      }
      const py = h * .88, phalf = roadHalf(.88);
      const px = roadX(py,h,w) + lane * phalf * .65 + (elapsed < slipUntil ? Math.sin(elapsed * 22) * w * .016 : 0);
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
      for (const fx of effects) { const life = (fx.until - elapsed) / .9; ctx.globalAlpha = clamp(life, 0, 1); ctx.fillStyle = fx.color; ctx.font = `900 ${Math.min(32,w/14)}px 'Black Han Sans'`; ctx.textAlign = 'center'; ctx.fillText(fx.text, w/2, h*.45 - (1-life)*35); ctx.globalAlpha = 1; }
    }
    function frame(now) {
      if (!playing) return;
      if (now - drawnAt < 30) { raf = requestAnimationFrame(frame); return; }
      drawnAt = now;
      const dt = Math.min(.05, (now - previous) / 1000 || 0); previous = now; elapsed += dt;
      const oldLane = lane;
      lane = clamp(lane + steer * dt * 1.28, -.88, .88);
      lean += (steer - lean) * Math.min(1, dt * 7);
      if (mode === 'multi') {
        if (!finished) distance = Math.min(TOTAL, distance + speed * dt);
        if (elapsed - progressAt > .2) { progressAt = elapsed; onProgress(getState()); }
        effects = effects.filter(fx => fx.until > elapsed);
        if (!document.hidden) draw(); raf = requestAnimationFrame(frame); return;
      }
      const target = elapsed < slowUntil ? 11 : elapsed < boostUntil ? 32 : 23;
      speed += (target - speed) * Math.min(1, dt * 2.3);
      if (speed > 14 && Math.abs(lean) > .3) charge = Math.min(3, charge + Math.abs(lane - oldLane) * .22);
      const offRoad = Math.abs(lane) > .79 && elapsed >= shieldUntil;
      const before = distance;
      distance = Math.min(TOTAL, distance + speed * (offRoad ? .66 : 1) * dt);
      for (const event of COURSE) {
        if (event.at <= before || event.at > distance || Math.abs(lane - event.lane) > (event.kind === 'box' ? .36 : .28)) continue;
        if (event.kind === 'cone' && elapsed >= hitUntil && elapsed >= shieldUntil) {
          obstaclesHit++; hitUntil = elapsed + 1.4; slowUntil = Math.max(slowUntil, elapsed + 2.1);
          effects.push({ text: '충돌! 속도 감소', until: elapsed + .9, color: '#ffaaa4' });
          options.onEvent?.({ kind: 'hit', distance: event.at });
        } else if (event.kind === 'pad') {
          padsTaken++; boostUntil = Math.max(boostUntil, elapsed) + 1.6;
          effects.push({ text: 'SPEED PAD!', until: elapsed + .9, color: '#8bf2ff' });
          options.onEvent?.({ kind: 'pad', distance: event.at });
        } else if (event.kind === 'star') {
          starsTaken++; charge = Math.min(3, charge + 1);
          effects.push({ text: 'STAR +1', until: elapsed + .9, color: '#ffe36c' });
          options.onEvent?.({ kind: 'star', distance: event.at });
        } else if (event.kind === 'box' && !heldItem) {
          heldItem = ['banana', 'missile', 'shield'][itemCount++ % 3];
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
      }
      bananas = bananas.filter(b => b.until > elapsed);
      if (!question && elapsed >= questionAt) nextQuestion();
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
    function destroy() { stop(); }
    function setSteer(value) { steer = clamp(value, -1, 1); }
    function setProgress(value) { distance = clamp(Number(value) || 0, 0, TOTAL); draw(); }
    function setRemoteState(kart) {
      if (!kart) return;
      distance = clamp(Number(kart.distance) || 0, 0, TOTAL);
      speed = Math.max(0, (Number(kart.speed) || 0) / 3.6);
      charge = clamp(Number(kart.charge) || 0, 0, 3);
      heldItem = kart.heldItem || '';
      if (kart.boosted) boostUntil = elapsed + 1.4;
      if (kart.shielded) shieldUntil = elapsed + 1.4;
      if (kart.slipping) slipUntil = elapsed + 1.4;
      finished = Boolean(kart.finishedAt);
      if (kart.finishedAt) speed = 0;
      draw();
    }
    return { start, stop, destroy, answer, useItem, useWeapon, setSteer, setOpponents, setProgress, setRemoteState, getState, draw, get question() { return question; } };
  }
  window.GrammarKart = { createRace: makeRace, paintPreview, paintShowcase, distance: TOTAL, course: COURSE };
})();
