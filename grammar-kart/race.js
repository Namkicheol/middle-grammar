/* Shared race surface for solo and classroom rooms. No network assumptions here. */
(function () {
  'use strict';
  const art = {};
  const KART_PAINT = { cyan: '#35d6dc', coral: '#f65b65', gold: '#ffd04e', violet: '#a879ed', lime: '#94db64', pink: '#ef8bc0' };
  if (typeof Image !== 'undefined') {
    for (const [key, file] of Object.entries({ backdrop: 'clean-v2/coastal-sky.webp', roadside: 'clean-v2/roadside.webp', obstacles: 'race-obstacles-atlas.webp', items: 'race-items-atlas.webp', teal: 'kart-rear-teal.webp', red: 'kart-rear-red.webp', yellow: 'kart-rear-yellow.webp' })) {
      const img = new Image(); img.decoding = 'async'; img.src = `assets/art/${['teal','red','yellow'].includes(key) ? 'clean-v2/' : ''}${file}`; art[key] = img;
    }
    for (const design of ['teal', 'red', 'yellow']) for (const pose of ['left', 'right']) {
      const img = new Image(); img.decoding = 'async'; img.src = `assets/art/clean-v2/kart-${pose}-${design}.webp`;
      art[`${design}-${pose}`] = img;
    }
    for (const design of ['teal', 'red', 'yellow']) {
      const img = new Image(); img.decoding = 'async'; img.src = `assets/art/clean-v2/kart-rear-${design}.webp`;
      art[`showcase-${design}`] = img;
    }
    art.variants = new Map();
  }
  const TOTAL = 1800;
  const QUESTION_MARKS = [450, 900, 1350];
  const COLORS = ['#ffce51', '#f66a60', '#69def0', '#b79aff', '#8ee47e', '#ff9ccb'];
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const norm = s => String(s).trim().toLowerCase().replace(/[.!?\s]+/g, '');
  function tinted(source, key, color) {
    if (!source?.complete || !source.naturalWidth) return null;
    if (art.variants.has(key)) return art.variants.get(key);
    const canvas = document.createElement('canvas'); canvas.width = Math.min(256, source.naturalWidth); canvas.height = Math.round(source.naturalHeight * canvas.width / source.naturalWidth);
    const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(source, 0, 0, canvas.width, canvas.height);
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
  }).flat().filter(event => !(['cone','banana'].includes(event.kind) && QUESTION_MARKS.some(mark => event.at >= mark - 20 && event.at <= mark + 335)));

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
    let questionIndex = 0;
    let question = null;
    const answerLanes = [-.75,-.25,.25,.75];
    let gate = null;
    let completedGate = '';
    let laneTarget = null;
    function setGateQuestion(q, occurrence) {
      if (!q) { gate = null; return; }
      const key = `${q.id}:${occurrence ?? q.occurrenceIndex ?? 0}`;
      if (gate?.key === key || completedGate === key) return;
      const reading = (q.eng || '').length + q.opts.join(' ').length;
      gate = { key, question: q, at: Math.min(TOTAL - 20, distance + (reading > 170 ? 320 : 260)) };
    }
    function selectGateLane(index) {
      if (!gate || gate.submitted || index < 0 || index > 3) return;
      steer = 0; laneTarget = answerLanes[index];
    }
    function crossGate() {
      if (!gate || gate.submitted || distance < gate.at - 4) return;
      const index = answerLanes.reduce((best,value,i)=>Math.abs(lane-value)<Math.abs(lane-answerLanes[best])?i:best,0);
      const crossed = gate;
      completedGate = crossed.key;
      if (mode === 'solo') { gate = null; answer(crossed.question.opts[index]); }
      else { crossed.submitted = true; crossed.index = index; options.onGateChoice?.(crossed.question.opts[index]); }
    }
    function retryGate() {
      if (!gate?.submitted) return false;
      options.onGateChoice?.(gate.question.opts[gate.index]);
      return true;
    }

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
    let boostVisual = 0;
    let size = { w: 0, h: 0, scale: 0 };
    let destroyed = false;
    const ai = [
      ['comet','코멧','red','coral',31.5,-.62], ['bolt','볼트','yellow','gold',32,.52],
      ['nova','노바','teal','violet',29.5,.06], ['ace','에이스','red','cyan',30,-.28],
      ['spark','스파크','yellow','lime',31,.32], ['luna','루나','teal','pink',29,-.48],
      ['dash','대시','yellow','coral',30.5,.68], ['pixel','픽셀','red','violet',32.5,-.08]
    ].map(([id,name,design,kartColor,base,lane],i)=>({id,name,design,kartColor,base,lane,
      color:COLORS[i%COLORS.length],wobble:.2+i*.025,distance:-i*3,slot:i,homeLane:lane}));
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
      asked++;
      setGateQuestion(question, asked);
      onQuestion({ question, number: asked, seconds: 16 });
    }
    function answer(choice) {
      if (!question || finished) return false;
      const q = question;
      const good = norm(choice) === norm(q.ans);
      question = null;
      if (gate) completedGate = gate.key; gate = null; laneTarget = null;
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
        ...opponents.map(o => ({ id: o.id, name: o.name, distance: o.distance, elapsed: o.finishedAt || null, me: false }))]
        .sort((a, b) => b.distance - a.distance || (a.elapsed ?? Infinity) - (b.elapsed ?? Infinity));
      return { distance: Math.round(distance), total: TOTAL, speed: Math.round(speed * 3.6), lane: +lane.toFixed(2), obstaclesHit, padsTaken, starsTaken,
        elapsed: +elapsed.toFixed(1), questionRemaining: gate ? Math.max(0, Math.ceil((gate.at-distance)/Math.max(speed,14))) : null,
        charge, boostStock, missiles, shields, heldItem, gatePending: !!gate?.submitted, answerLane: gate ? answerLanes.reduce((best,value,i)=>Math.abs(lane-value)<Math.abs(lane-answerLanes[best])?i:best,0) : null, gateRemaining: gate ? Math.max(0,Math.ceil((gate.at-distance)/Math.max(speed,14))) : null, correct, asked, rank: standings.findIndex(s => s.me) + 1,
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
        const width = 108 * size;
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
          ctx.strokeStyle = '#45545b88'; ctx.lineWidth = Math.max(1, size * 1.4);
          const offset = distance * .45 % (wheelH / 3);
          for (let n = -1; n < 5; n++) { const yy = wheelY - wheelH/2 + n * wheelH/3 + offset; ctx.beginPath(); ctx.moveTo(wheelX-wheelW*.32, yy); ctx.lineTo(wheelX+wheelW*.32, yy+wheelH*.055); ctx.stroke(); }
          ctx.restore();
        }
        if (player && elapsed < shieldUntil) { ctx.strokeStyle = '#a0f9ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, -width * .24, width * .43, width * .32, 0, 0, 7); ctx.stroke(); }
        ctx.restore();
        if (label && !player) { ctx.fillStyle = '#fff'; ctx.font = `900 ${player ? 13 : 11}px Nunito`; ctx.textAlign = 'center'; ctx.fillText(label, x, y - width * .53); }
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
      if (label && !player) { ctx.fillStyle = '#ffffff'; ctx.font = `900 ${player ? 13 : 11}px Nunito`; ctx.textAlign = 'center'; ctx.fillText(label, x, y - 43 * size); }
    }
    function draw() {
      if (document.hidden || destroyed) return;
      if (!size.w || !size.h) resize();
      const { w, h } = size;
      if (!w || !h) return;
      const boosted = elapsed < boostUntil;
      const horizon = h * .32;
      const viewDepth = 360;
      const lens = 13 - boostVisual * 3;
      const roadPoint = (t, offset = 0) => {
        const ahead = clamp(1 - t, 0, 1) * viewDepth;
        const scale = lens / (lens + ahead);
        const bend = clamp(trackCenter(distance + ahead) - trackCenter(distance) - trackSlope(distance) * ahead * .4, -34, 34);
        const rise = trackHeight(distance + ahead) - trackHeight(distance);
        const bank = trackSlope(distance + ahead) * h * .05 * scale;
        return {
          x: w * (.5 - lane * .38 * scale + bend * .048 * scale) + offset * (w * (.68 + boostVisual * .035) * scale + 3),
          y: horizon + (h - horizon) * scale * 1.05 - rise * h * .006 * (.25 + scale) + offset * bank,
          scale
        };
      };
      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, '#5eb8e7'); sky.addColorStop(1, '#d5f2f2');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      if (art.backdrop?.complete && art.backdrop.naturalWidth) {
        const panorama = art.backdrop;
        const drift = -trackSlope(distance) * w * .22 - lane * w * .025;
        ctx.drawImage(panorama, 0, panorama.naturalHeight * .28, panorama.naturalWidth, panorama.naturalHeight * .62,
          -w * .15 + drift, 0, w * 1.3, horizon + 8);
      }
      const turf = ctx.createLinearGradient(0,horizon,0,h);
      turf.addColorStop(0,'#91c8ac'); turf.addColorStop(.55,'#62b095'); turf.addColorStop(1,'#439482');
      ctx.fillStyle = turf; ctx.fillRect(0, horizon, w, h - horizon);
      function strip(a, b, left, right, color) {
        const p1 = roadPoint(a, left), p2 = roadPoint(b, left), p3 = roadPoint(b, right), p4 = roadPoint(a, right);
        ctx.beginPath(); ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.lineTo(p3.x,p3.y);ctx.lineTo(p4.x,p4.y);ctx.closePath();
        ctx.fillStyle = color;ctx.fill();
      }
      // Draw world-space strips far-to-near. The near camera makes road markings
      // and kerbs expand quickly instead of sliding a flat texture underneath.
      const first = Math.floor((distance + viewDepth) / 9) * 9;
      for (let at = first; at > distance - 9; at -= 9) {
        const a = clamp(1 - (at - distance) / viewDepth, 0, 1);
        const b = clamp(1 - (at + 9 - distance) / viewDepth, 0, 1);
        const index = Math.floor(at / 9), even = index % 2 === 0;
        strip(a,b,-1.09,1.09,even ? '#ecf6ec' : '#48ccbc');
        strip(a,b,-1,1,even ? '#344358' : '#35455b');
        strip(a,b,-1.005,-.98,'#ecf4ee'); strip(a,b,.98,1.005,'#ecf4ee');
        if (even) for (const line of [-.325,0,.325]) strip(a,b,line-.008,line+.008,'#a6bac6');
      }
      // Simple dimensional safety rails and passing trees share road projection.
      for (const side of [-1,1]) {
        ctx.beginPath();
        for (let i=0;i<=40;i++) {const t=i/40,p=roadPoint(t,side*1.12),y=p.y-18*p.scale;i?ctx.lineTo(p.x,y):ctx.moveTo(p.x,y);}
        ctx.strokeStyle='#ebf4f0';ctx.lineWidth=4;ctx.lineJoin='round';ctx.stroke();
        ctx.strokeStyle='#407677';ctx.lineWidth=2;ctx.stroke();
      }
      for(let at=Math.floor((distance+viewDepth)/24)*24;at>=distance;at-=24){
        const t=1-(at-distance)/viewDepth;
        for(const side of [-1,1]){
          const p=roadPoint(t,side*1.16),sc=p.scale;
          ctx.fillStyle='#3d7675';ctx.fillRect(p.x-2*sc,p.y-18*sc,4*sc,19*sc);
          if (art.roadside?.naturalWidth) {
            const cell=(Math.floor(at/24)+(side>0?1:0))%4;
            const tree=roadPoint(t,side*(cell===3?1.35:1.6));
            const width=(cell===3?138:190)*sc;
            ctx.fillStyle='#246d6555';ctx.beginPath();ctx.ellipse(tree.x,tree.y,width*.32,width*.06,0,0,7);ctx.fill();
            ctx.drawImage(art.roadside,(cell%2)*512,Math.floor(cell/2)*512,512,512,
              tree.x-width/2,tree.y-width*.96,width,width);
          }
        }
      }
      for (const event of COURSE) {
        const delta = event.at - distance;
        if (delta < -18 || delta > viewDepth) continue;
        const t = clamp(1 - delta / viewDepth, 0, 1.04), p = roadPoint(t, event.lane * .65), y = p.y;
        if (y < horizon || y > h) continue;
        const x = p.x;
        const sc=p.scale;
        if(event.kind==='cone'){
          const r=25*sc, tall=48*sc;
          ctx.fillStyle='#192d4666';ctx.beginPath();ctx.ellipse(x,y,r*1.12,r*.3,0,0,7);ctx.fill();
          ctx.fillStyle='#25354a';ctx.beginPath();ctx.roundRect(x-r,y-r*.25,r*2,r*.55,3*sc);ctx.fill();
          ctx.fillStyle='#ff8753';ctx.beginPath();ctx.moveTo(x,y-tall);ctx.lineTo(x-r*.68,y);ctx.lineTo(x+r*.68,y);ctx.closePath();ctx.fill();
          ctx.fillStyle='#d8583a';ctx.beginPath();ctx.moveTo(x,y-tall);ctx.lineTo(x+r*.68,y);ctx.lineTo(x,y);ctx.closePath();ctx.fill();
          ctx.fillStyle='#fff6db';ctx.beginPath();ctx.moveTo(x-r*.25,y-tall*.64);ctx.lineTo(x+r*.25,y-tall*.64);ctx.lineTo(x+r*.4,y-tall*.42);ctx.lineTo(x-r*.4,y-tall*.42);ctx.closePath();ctx.fill();
        }else if(event.kind==='box'){
          const r=25*sc;
          ctx.fillStyle='#172a4566';ctx.beginPath();ctx.ellipse(x,y,r*1.15,r*.3,0,0,7);ctx.fill();
          ctx.fillStyle='#49cddb';ctx.fillRect(x-r,y-r*1.8,r*1.6,r*1.6);
          ctx.fillStyle='#278eae';ctx.beginPath();ctx.moveTo(x+r*.6,y-r*1.8);ctx.lineTo(x+r,y-r*2);ctx.lineTo(x+r,y-r*.4);ctx.lineTo(x+r*.6,y-r*.2);ctx.closePath();ctx.fill();
          ctx.fillStyle='#aaf8ed';ctx.beginPath();ctx.moveTo(x-r,y-r*1.8);ctx.lineTo(x-r*.6,y-r*2);ctx.lineTo(x+r,y-r*2);ctx.lineTo(x+r*.6,y-r*1.8);ctx.closePath();ctx.fill();
          ctx.fillStyle='#f5f7dc';ctx.font=`900 ${Math.max(5,30*sc)}px system-ui`;ctx.textAlign='center';ctx.fillText('?',x-r*.15,y-r*.65);
        }else if(event.kind==='banana'&&art.obstacles?.naturalWidth){
          const width=64*sc;ctx.drawImage(art.obstacles,384,0,192,192,x-width/2,y-width*164/192,width,width);
        }else if(event.kind==='pad'){
          const r=34*sc;ctx.fillStyle='#238d9e';ctx.fillRect(x-r,y-12*sc,r*2,18*sc);
          for(let n=0;n<3;n++){const yy=y-(n*6-3)*sc;ctx.strokeStyle='#8affed';ctx.lineWidth=3*sc;ctx.beginPath();ctx.moveTo(x-r*.6,yy);ctx.lineTo(x,yy-5*sc);ctx.lineTo(x+r*.6,yy);ctx.stroke();}
        }else{
          const r=18*sc;ctx.fillStyle='#ffdc5c';ctx.beginPath();
          for(let n=0;n<10;n++){const angle=-Math.PI/2+n*Math.PI/5,rr=n%2?r*.48:r;const xx=x+Math.cos(angle)*rr,yy=y-r+Math.sin(angle)*rr;n?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);}ctx.closePath();ctx.fill();
          ctx.strokeStyle='#fff2b0';ctx.lineWidth=Math.max(1,sc*2);ctx.stroke();
        }
      }
      if(gate){
        const delta=gate.at-distance,t=1-delta/viewDepth;
        if(delta<viewDepth&&delta>=-8){
          const colors=['#50c9ed','#ff925e','#9e84ef','#f8d564'];
          const selected=answerLanes.reduce((best,value,i)=>Math.abs(lane-value)<Math.abs(lane-answerLanes[best])?i:best,0);
          for(let i=0;i<4;i++){
            const p=roadPoint(t,answerLanes[i]*.65),width=w*.18*p.scale,tall=96*p.scale;
            ctx.fillStyle='#12284266';ctx.beginPath();ctx.ellipse(p.x,p.y,width*.55,9*p.scale,0,0,7);ctx.fill();
            ctx.fillStyle=colors[i];ctx.fillRect(p.x-width/2,p.y-8*p.scale,width,8*p.scale);
            ctx.fillStyle=selected===i?colors[i]:'#20364cdc';
            ctx.beginPath();ctx.roundRect(p.x-width/2,p.y-tall,width,tall*.72,8*p.scale);ctx.fill();
            ctx.strokeStyle=colors[i];ctx.lineWidth=(selected===i?4:2)*p.scale;ctx.stroke();
            ctx.fillStyle=selected===i?'#152b42':'#fff';ctx.font=`900 ${Math.max(9,44*p.scale)}px system-ui`;
            ctx.textAlign='center';ctx.fillText('ABCD'[i],p.x,p.y-tall*.48);
            ctx.fillStyle=colors[i];ctx.fillRect(p.x-width*.45,p.y-tall*.27,3*p.scale,tall*.27);ctx.fillRect(p.x+width*.4,p.y-tall*.27,3*p.scale,tall*.27);
          }
          const p=roadPoint(t);ctx.strokeStyle='#ecffefcc';ctx.lineWidth=3*p.scale;
          ctx.beginPath();const l=roadPoint(t,-.65),r=roadPoint(t,.65);ctx.moveTo(l.x,l.y);ctx.lineTo(r.x,r.y);ctx.stroke();
        }
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
        const ahead = 12 + (Math.max(12, target.distance-distance) - 12) * flight;
        const p = roadPoint(1-ahead/viewDepth, target.lane*.65*flight), width = (65+flight*20)*p.scale;
        ctx.save(); ctx.translate(p.x,p.y-width*.3); ctx.rotate(-Math.PI/2);
        if (art.items?.complete && art.items.naturalWidth) ctx.drawImage(art.items, 256,0,128,128,-width/2,-width/2,width,width);
        else { ctx.fillStyle='#ffcf63'; ctx.fillRect(-width/2,-width/4,width,width/2); }
        ctx.restore();
        ctx.strokeStyle = '#ffda89aa'; ctx.lineWidth = Math.max(1,width*.13); ctx.beginPath(); ctx.moveTo(p.x,p.y+width*.1); ctx.lineTo(p.x,p.y+width*.9); ctx.stroke();
      }
      for (const impact of impacts) {
        const delta = impact.targetId ? Math.max(12, impact.at-distance) : impact.at-distance;
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
      const visible = opponents.filter(o => (o.distance - distance > -8 || targetIds.has(o.id)) && o.distance - distance < viewDepth)
        .sort((a,b) => Math.abs(a.distance-distance) - Math.abs(b.distance-distance)).slice(0, w < 500 ? 6 : 8)
        .sort((a,b) => b.distance - a.distance);
      for (const o of visible) {
        const delta = Math.max(targetIds.has(o.id) ? 12 : 4, o.distance-distance);
        const p = roadPoint(1 - delta / viewDepth, o.lane * .65);
        if (p.y > horizon + 10 && p.y < h * .95) kart(p.x, p.y, .12 + p.scale * .98, o.color, delta > 10 ? o.name : '',
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
      if (speed > 12) {
        const intensity=clamp((speed-12)/20,0,1), count=boosted?18:8;
        ctx.lineWidth=boosted?2:1.2;
        for(let i=0;i<count;i++){
          const side=i%2?1:-1,phase=((i*.173+distance*.065)%1),near=phase*phase;
          const y=horizon+near*(h-horizon),x=w*.5+side*w*(.3+near*.25);
          ctx.strokeStyle=`rgba(220,252,255,${intensity*(boosted?.6:.25)})`;
          ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+side*(4+near*12),y+8+near*(boosted?55:28));ctx.stroke();
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
      const dt = Math.min(.15, (now - previous) / 1000 || 0); previous = now; elapsed += dt;
      boostVisual += ((elapsed < boostUntil ? 1 : 0) - boostVisual) * Math.min(1, dt * 4);
      const oldLane = lane;
      const step = dt * 1.28 * (elapsed < slipUntil ? .45 : 1);
      const driveSteer = laneTarget == null ? steer : Math.sign(laneTarget - lane);
      lane = clamp(laneTarget == null ? lane + driveSteer * step +
        (elapsed < slipUntil ? Math.sin(elapsed * 27) * dt * .28 : 0)
        : lane + clamp(laneTarget - lane, -step, step), -.88, .88);
      if (laneTarget != null && Math.abs(laneTarget - lane) < .001) laneTarget = null;
      lean += (driveSteer - lean) * Math.min(1, dt * 7);
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
        crossGate(); updateProjectiles();
        if (elapsed - progressAt > .2) { progressAt = elapsed; onProgress(getState()); }
        effects = effects.filter(fx => fx.until > elapsed);
        if (!document.hidden) draw(); raf = requestAnimationFrame(frame); return;
      }
      const target = elapsed < slowUntil ? 14 : elapsed < boostUntil ? 46 : elapsed < draftUntil ? 34 : 31;
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
        const catchup = clamp((distance - o.distance) / 85, -1.5, 2.2);
        const comBoost = elapsed > 8 && ((elapsed + o.slot * 2.9) % 21) < 2.6 ? 6 : 0;
        o.distance = Math.min(TOTAL, o.distance + (elapsed < (o.slowUntil || 0) ? 13 : o.base + catchup + comBoost) * dt);
        if(o.distance>=TOTAL&&!o.finishedAt){o.finishedAt=elapsed;o.finished=true;}
        const targetLane = clamp(o.homeLane + Math.sin(elapsed * .45 + o.slot * 1.7) * .23,-.72,.72);
        o.lane += (targetLane-o.lane)*Math.min(1,dt*.8);
        for (const banana of bananas) if (banana.owner !== o.id && banana.at > old && banana.at <= o.distance && Math.abs(o.lane - banana.lane) < .3 && elapsed >= (o.hitUntil || 0)) {
          o.slowUntil = elapsed + 2.5; o.hitUntil = elapsed + 1.7; banana.until = 0;
          effects.push({ text: `${o.name} 미끄러짐!`, until: elapsed + .9, color: '#ffe36c' });
        }
        for (const event of COURSE) if (event.kind === 'banana' && event.at > old && event.at <= o.distance && Math.abs(o.lane-event.lane)<.3 && elapsed >= (o.hitUntil||0)) {
          o.slowUntil=elapsed+2.5; o.hitUntil=elapsed+1.7;
        }
        const gateSafe = gate && gate.at-distance < 85 && gate.at-distance > -12;
        if (!gateSafe && distance > 40 && Math.abs(o.distance-distance) < 3.5 && Math.abs(o.lane-lane) < .18 &&
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
      crossGate();
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
    function setSteer(value) { steer = clamp(value, -1, 1); if (steer) laneTarget=null; }
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
    return { start, stop, destroy, answer, useItem, useWeapon, setSteer, setOpponents, setProgress, setRemoteState, setGateQuestion, selectGateLane, retryGate, playCue, getState, draw, get question() { return question; } };
  }
  window.GrammarKart = { createRace: makeRace, paintPreview, paintShowcase, distance: TOTAL, course: COURSE };
})();
