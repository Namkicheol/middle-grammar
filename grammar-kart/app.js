(function () {
  'use strict';
  const root = document.getElementById('kart-app');
  const app = { race: null, mode: 'solo', options: null };
  const $ = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text != null) el.textContent = text; return el; };
  const fmt = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}.${Math.floor((seconds % 1) * 10)}`;
  const audio = (name) => window.KartAudio?.play?.(name);
  const allLessons = Object.entries(typeof GAME_QUESTIONS !== 'undefined' ? GAME_QUESTIONS : {})
    .filter(([key, item]) => /^g[12]-l\d+$/.test(key) && item.questions?.some(q => q.opts?.length === 4));
  let selectedLesson = allLessons[0]?.[0] || 'g1-l1';
  let selectedDesign = 'teal';
  let selectedColor = 'cyan';
  let soundMuted = false;
  try { selectedLesson = localStorage.getItem('grammar-kart-lesson') || selectedLesson; } catch (_) {}
  try { selectedDesign = localStorage.getItem('grammar-kart-design') || selectedDesign; } catch (_) {}
  try { selectedColor = localStorage.getItem('grammar-kart-color') || selectedColor; } catch (_) {}
  if (!['teal','red','yellow'].includes(selectedDesign)) selectedDesign = 'teal';
  if (!['cyan','coral','gold','violet','lime','pink'].includes(selectedColor)) selectedColor = 'cyan';
  try { soundMuted = localStorage.getItem('grammar-kart-muted') === '1'; } catch (_) {}
  window.KartAudio?.setMuted?.(soundMuted);

  function bestFor(lesson) { try { return Number(localStorage.getItem(`grammar-kart-best-${lesson}`)) || 0; } catch (_) { return 0; } }
  function saveBest(lesson, seconds) { try { localStorage.setItem(`grammar-kart-best-${lesson}`, String(seconds)); } catch (_) {} }
  function lessonLabel(lesson) { return GAME_QUESTIONS[lesson]?.label || '문법 그랑프리'; }
  function itemGuide() {
    const details = $('details', 'item-guide');
    const summary = $('summary', '', '아이템 설명');
    const panel = $('div', 'item-guide-panel');
    panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', '레이스 아이템 설명');
    const header = $('div', 'item-guide-header');
    header.append($('h2', '', '아이템 안내'));
    const close = $('button', 'item-guide-close', '닫기'); close.type = 'button';
    close.addEventListener('click', () => { details.open = false; summary.focus(); });
    header.append(close); panel.append(header);
    const list = $('ul', '');
    [
      ['정답 보상', '정답을 맞히면 부스터·미사일·방어막 중 하나를 얻어요.'],
      ['⚡ 부스터', '부스터 1개 또는 충전 3칸을 써서 5초 동안 가속해요. 버튼이나 스페이스바로 사용해요.'],
      ['🚀 미사일', '앞쪽 220m 안에 상대가 있을 때 발사해요. 대상이 없으면 소모되지 않아요.'],
      ['🛡 방어막', '5초 동안 코스 장애물과 상대가 놓은 바나나·미사일을 막아요.'],
      ['🍌 바나나', '사용하면 내 뒤에 놓여요. 같은 레인을 지나는 상대를 느리게 해요.'],
      ['⭐ 별 · 🪙 코인', '각각 충전 +1, 최대 3칸이에요. 코인은 점수가 아니에요.'],
      ['SPEED PAD', '밟으면 부스트가 1.6초 더 이어져요.'],
      ['❔ 상자', '손에 든 아이템이 없을 때 바나나를 줘요.']
    ].forEach(([name, explanation]) => {
      const row = $('li', ''); row.append($('strong', '', name), document.createTextNode(` · ${explanation}`)); list.append(row);
    });
    panel.append(list);
    details.append(summary, panel);
    summary.setAttribute('aria-label', '아이템 설명 열기 또는 닫기');
    details.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !details.open) return;
      event.preventDefault(); details.open = false; summary.focus();
    });
    return details;
  }
  function setRaceHint(container) {
    const keyboard = $('span', 'hint-keyboard', '← → 조향 · 1~4 답안 레인 · Space 부스터 · X 아이템');
    const pickups = $('span', 'hint-pickups', '⭐/🪙 충전 +1 · PAD 부스트 +1.6초 · ? 바나나');
    container.replaceChildren(keyboard, pickups, itemGuide());
  }
  function setGarageHint(container) {
    const keyboard = $('span', 'garage-help-keyboard', '← → 조향 · A–D 답안 레인 · Space 부스터 · X 아이템');
    const pickups = $('span', 'garage-help-pickups', '⭐/🪙 충전 +1 · PAD +1.6초 · ? 바나나');
    container.replaceChildren(keyboard, pickups, itemGuide());
  }
  function bindSound() {
    const mast = root.querySelector('.mast');
    if (!mast) return;
    const button = $('button', 'sound', soundMuted ? '🔇 소리 켜기' : '🔊 소리 끄기');
    button.type = 'button'; button.setAttribute('aria-pressed', String(!soundMuted));
    button.addEventListener('click', () => {
      soundMuted = !soundMuted;
      window.KartAudio?.setMuted?.(soundMuted);
      if (!soundMuted && app.race) { window.KartAudio?.unlock?.(); window.KartAudio?.startMusic?.(); }
      try { localStorage.setItem('grammar-kart-muted', soundMuted ? '1' : '0'); } catch (_) {}
      button.textContent = soundMuted ? '🔇 소리 켜기' : '🔊 소리 끄기';
      button.setAttribute('aria-pressed', String(!soundMuted));
    });
    mast.insertBefore(button, mast.lastElementChild);
  }
  function shell(inner) { root.innerHTML = `<div class="shell"><header class="mast"><div class="brand">GRAMMAR <b>GP</b></div><a class="back" href="../game/">게임 허브 ↗</a></header>${inner}</div>`; }
  function showMenu() {
    app.race?.destroy(); app.race = null;
    window.KartAudio?.stopMusic?.();
    shell(`<main class="garage"><section class="showroom" aria-label="선택한 카트 전시"><div class="showroom-label">GRAMMAR GRAND PRIX <span>COASTAL CIRCUIT</span></div><canvas id="showcase" width="512" height="512" aria-label="선택한 카트"></canvas><div class="showroom-caption">내 카트를 골라 출발!</div></section><div class="garage-design"><span>카트 디자인</span><div class="design-options" id="design-options"><button type="button" data-design="teal"><img src="assets/art/coastal-v3/kart-showcase-teal.webp" alt="">SPRINT</button><button type="button" data-design="red"><img src="assets/art/coastal-v3/kart-showcase-red.webp" alt="">BLAZE</button><button type="button" data-design="yellow"><img src="assets/art/coastal-v3/kart-showcase-yellow.webp" alt="">BOLT</button></div></div><section class="garage-panel"><div class="eyebrow">RACE SETUP</div><h1>출발 준비</h1><label>레이스 문법 단원<select id="lesson-select"></select></label><div class="garage-paint"><div><span class="custom-label">색상 선택</span><div class="color-options" id="color-options"><button type="button" data-color="cyan" aria-label="블루"></button><button type="button" data-color="coral" aria-label="코랄"></button><button type="button" data-color="gold" aria-label="골드"></button><button type="button" data-color="violet" aria-label="보라"></button><button type="button" data-color="lime" aria-label="라임"></button><button type="button" data-color="pink" aria-label="핑크"></button></div></div></div><button class="primary" id="solo-start">혼자 달리기 ▶</button><a class="secondary multi-link" href="../multiplayer/">친구와 달리기 ▶</a><div class="best" id="best-time"></div><div class="garage-help"></div></section></main>`);
    setGarageHint(root.querySelector('.garage-help'));
    bindSound();
    const select = document.getElementById('lesson-select');
    for (const [key, item] of allLessons) { const opt = new Option(item.label, key); select.add(opt); }
    if (allLessons.some(([key]) => key === selectedLesson)) select.value = selectedLesson;
    const updateBest = () => { const best = bestFor(select.value); document.getElementById('best-time').textContent = best ? `🏆 개인 최고 기록 ${fmt(best)}` : '🏆 첫 레이스에서 최고 기록을 세워 보세요!'; };
    updateBest();
    select.addEventListener('change', () => { selectedLesson = select.value; try { localStorage.setItem('grammar-kart-lesson', selectedLesson); } catch (_) {} updateBest(); });
    const updateKart = () => {
      root.querySelectorAll('[data-design]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.design === selectedDesign)));
      root.querySelectorAll('[data-color]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.color === selectedColor)));
      window.GrammarKart.paintShowcase(document.getElementById('showcase'), selectedDesign, selectedColor);
      try { localStorage.setItem('grammar-kart-design', selectedDesign); localStorage.setItem('grammar-kart-color', selectedColor); } catch (_) {}
    };
    root.querySelectorAll('[data-design]').forEach(b => b.addEventListener('click', () => { selectedDesign = b.dataset.design; updateKart(); }));
    root.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => { selectedColor = b.dataset.color; updateKart(); }));
    updateKart();
    document.getElementById('solo-start').addEventListener('click', () => {
      window.KartAudio?.unlock?.(); window.KartAudio?.startMusic?.();
      startRace({ mode: 'solo', lesson: select.value, playerName: '나', kartDesign: selectedDesign, kartColor: selectedColor });
    });
  }
  function startRace(options) {
    app.race?.destroy();
    app.options = options; app.mode = options.mode || 'solo';
    const lesson = options.lesson || selectedLesson;
    root.innerHTML = `<div class="shell race-shell"><header class="mast"><div class="brand">GRAMMAR <b>GP</b></div><button class="back" id="leave" type="button">← 나가기</button></header><main><div class="race-top"><div class="race-title">COASTAL CIRCUIT<small id="lesson-label"></small></div><div class="speed"><span id="speed">0</span><small>KM/H</small></div><div class="place" id="place">1ST</div></div><div class="track-wrap"><canvas id="track" aria-label="문법 레이싱 트랙"></canvas><div class="race-hud"><div class="hud-card">⏱ RACE TIME<strong id="time">0:00.0</strong></div><div class="hud-card">🏁 TRACK<strong id="meters">0 / 1800 m</strong></div></div><div id="toast-area" aria-live="polite"></div></div><div class="progress" aria-label="트랙 진행률"><i id="bar"></i></div><div class="race-bottom"><section class="question waiting" id="question" aria-live="polite"><div><div class="question-head">ITEM CHANCE</div><h2>레이스가 시작됩니다!</h2><p>정답으로 아이템을 얻어 원하는 순간 사용하세요.</p></div></section><div class="controls"><button type="button" class="control" id="left" aria-label="왼쪽으로 조향">◀</button><button type="button" class="control" id="right" aria-label="오른쪽으로 조향">▶</button><button type="button" class="control item" id="item">⚡ 0%</button><button type="button" class="control weapon" id="weapon" disabled>아이템 없음</button></div></div><div class="hint"></div></main></div>`;
    setRaceHint(root.querySelector('.hint'));
    bindSound();
    document.getElementById('lesson-label').textContent = lessonLabel(lesson);
    const ui = {
      speed: document.getElementById('speed'), place: document.getElementById('place'), time: document.getElementById('time'), meters: document.getElementById('meters'),
      bar: document.getElementById('bar'), question: document.getElementById('question'), item: document.getElementById('item'), weapon: document.getElementById('weapon'), toast: document.getElementById('toast-area')
    };
    root.querySelector('.track-wrap').append(document.getElementById('left'), document.getElementById('right'), ui.question);
    ui.question.hidden = true;
    ui.missile = $('button', 'control weapon', '미사일'); ui.missile.id = 'missile'; ui.missile.type = 'button'; ui.missile.disabled = true;
    ui.shield = $('button', 'control weapon', '방어막'); ui.shield.id = 'shield'; ui.shield.type = 'button'; ui.shield.disabled = true;
    root.querySelector('.controls').append(ui.missile, ui.shield);
    let pendingAnswer = false;
    const toast = text => { ui.toast.innerHTML = ''; const t = $('div', 'toast', text); ui.toast.append(t); setTimeout(() => t.remove(), 750); };
    const race = window.GrammarKart.createRace({
      canvas: document.getElementById('track'), lesson, mode: app.mode, playerId: options.playerId || 'me', playerName: options.playerName || '나',
      kartDesign: options.kartDesign, kartColor: options.kartColor,
      onProgress: state => {
        window.KartAudio?.setEngineSpeed?.(state.speed, state.boosted);
        ui.speed.textContent = state.speed; ui.place.textContent = `${state.rank} / ${state.standings.length}`;
        ui.time.textContent = fmt(state.elapsed); ui.meters.textContent = `${state.distance} / ${state.total} m`; ui.bar.style.width = `${state.distance / state.total * 100}%`;
        ui.item.textContent = state.boostStock ? `부스터 ×${state.boostStock}` : state.charge >= 3 ? '부스터 준비' : `${Math.round(state.charge / 3 * 100)}%`;
        ui.item.style.setProperty('--meter', `${Math.round(state.charge / 3 * 100)}%`);
        ui.weapon.textContent = state.heldItem ? ({ banana: '바나나', missile: '미사일', shield: '방어막' }[state.heldItem]) : '아이템 없음';
        ui.weapon.disabled = !state.heldItem;
        ui.missile.textContent = `미사일 ${state.missiles || 0}`; ui.missile.disabled = !state.missiles;
        ui.shield.textContent = `방어막 ${state.shields || 0}`; ui.shield.disabled = !state.shields;
        ui.item.classList.toggle('ready', state.boostStock > 0 || state.charge >= 3);
        const timer = ui.question.querySelector('.question-timer');
        if (timer && state.gateRemaining != null) timer.textContent = `판정선 ${state.gateRemaining}초`;
        ui.question.querySelectorAll('.choices button').forEach((button,index)=>button.classList.toggle('lane-selected',index===state.answerLane));
        options.onProgress?.(state);
        if (window.parent !== window && app.mode === 'multi') window.parent.postMessage({ type: 'grammar-kart-progress', state }, location.origin);
      },
      onEvent: event => { audio(['banana_hit','drift','offroad'].includes(event.kind) ? 'skid' : ['hit','contact'].includes(event.kind) ? 'hit' : event.kind === 'pad' ? 'boost' : 'item'); options.onEvent?.(event); },
      onQuestion: ({ question, number }) => {
        pendingAnswer = false;
        ui.question.hidden = false; root.querySelector('.race-shell')?.classList.add('question-active');
        ui.question.classList.remove('waiting'); ui.question.innerHTML = '';
        const head = $('div', 'question-head'); head.append($('span', '', `Q${number} · 답안 레인으로 이동`), $('span', 'question-timer', '판정선 접근 중'));
        const kor = $('p', '', question.kor || '빈칸에 들어갈 알맞은 답을 고르세요.');
        const eng = $('h2', '', question.eng || question.question || question.prompt || '알맞은 답을 고르세요.');
        const choices = $('div', 'choices');
        question.opts.forEach((choice, i) => {
          const button = $('button', '', `${'ABCD'[i]}. ${choice}`); button.type = 'button'; button.dataset.answer = choice;
          button.addEventListener('click', () => choose(choice)); choices.append(button);
        });
        ui.question.append(head, kor, eng, choices);
        options.onQuestion?.(question);
      },
      onAnswer: result => {
        pendingAnswer = true;
        for (const button of ui.question.querySelectorAll('.choices button')) {
          button.disabled = true;
          if (button.dataset.answer === result.answer) button.classList.add('correct');
          else if (button.dataset.answer === result.choice) button.classList.add('wrong');
        }
        audio(result.correct ? 'correct' : 'wrong');
        toast(result.correct ? (result.reward ? `정답! ${({ boost: '부스터', missile: '미사일', shield: '방어막' })[result.reward]} 획득` : '정답! 아이템이 이미 가득해요') : '계속 달려!');
        options.onAnswer?.(result);
        if (window.parent !== window && app.mode === 'multi') window.parent.postMessage({ type: 'grammar-kart-answer', result }, location.origin);
        setTimeout(() => { if (app.race === race && !race.question) { ui.question.hidden = true; root.querySelector('.race-shell')?.classList.remove('question-active'); } }, 900);
      },
      onFinish: state => {
        race.destroy(); app.race = null;
        audio('finish'); window.KartAudio?.stopMusic?.(); options.onFinish?.(state);
        if (window.parent !== window && app.mode === 'multi') window.parent.postMessage({ type: 'grammar-kart-finish', state }, location.origin);
        if (app.mode === 'solo') { const best = bestFor(lesson); if (!best || state.elapsed < best) saveBest(lesson, state.elapsed); }
        showResult(state, lesson);
      }
    });
    app.race = race;
    function choose(value) { if (pendingAnswer || !race.question) return; race.selectGateLane(race.question.opts.indexOf(value)); }
    function useItem() { if (race.useItem()) { audio('boost'); toast('BOOST!'); } }
    function useWeapon(kind) { if (race.useWeapon(kind)) { audio(kind === 'missile' ? 'missile' : 'item'); toast(kind === 'missile' ? 'MISSILE!' : kind === 'shield' ? 'SHIELD!' : 'ITEM!'); }
      else if (kind === 'missile' && race.getState().missiles) toast('앞차가 있을 때 발사!'); }
    ui.item.addEventListener('click', useItem); ui.weapon.addEventListener('click', () => useWeapon());
    ui.missile.addEventListener('click', () => useWeapon('missile')); ui.shield.addEventListener('click', () => useWeapon('shield'));
    document.getElementById('leave').addEventListener('click', () => { race.stop(); window.KartAudio?.stopMusic?.(); showMenu(); });
    const pointerDirections = new Map();
    const keyHolds = { left: new Set(), right: new Set() };
    const directionForKey = key => ['ArrowLeft', 'a', 'A'].includes(key) ? 'left' : ['ArrowRight', 'd', 'D'].includes(key) ? 'right' : '';
    const isHeld = dir => keyHolds[dir].size > 0 || [...pointerDirections.values()].includes(dir);
    const updateSteer = () => race.setSteer((isHeld('right') ? 1 : 0) - (isHeld('left') ? 1 : 0));
    const clearHeld = () => {
      pointerDirections.clear();
      keyHolds.left.clear(); keyHolds.right.clear();
      updateSteer();
    };
    const onPointerDown = dir => ev => {
      ev.preventDefault();
      pointerDirections.set(ev.pointerId, dir);
      ev.currentTarget.setPointerCapture(ev.pointerId);
      updateSteer();
    };
    const onPointerRelease = ev => {
      if (pointerDirections.delete(ev.pointerId)) updateSteer();
    };
    for (const dir of ['left', 'right']) {
      const button = document.getElementById(dir);
      button.addEventListener('pointerdown', onPointerDown(dir));
      button.addEventListener('lostpointercapture', onPointerRelease);
    }
    const keydown = ev => {
      if (app.race !== race) return;
      const direction = directionForKey(ev.key);
      if (direction) { ev.preventDefault(); keyHolds[direction].add(ev.key); updateSteer(); }
      if ('1234'.includes(ev.key) && ev.key.length === 1 && race.question) { const choice = race.question.opts[Number(ev.key) - 1]; if (choice) choose(choice); }
      if (ev.code === 'Space') { ev.preventDefault(); useItem(); }
      if (ev.key === 'x' || ev.key === 'X') { ev.preventDefault(); useWeapon(); }
    };
    const keyup = ev => {
      const direction = directionForKey(ev.key);
      if (direction && keyHolds[direction].delete(ev.key)) updateSteer();
    };
    const visibilityChange = () => { if (document.visibilityState === 'hidden') clearHeld(); };
    window.addEventListener('pointerup', onPointerRelease);
    window.addEventListener('pointercancel', onPointerRelease);
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup);
    window.addEventListener('blur', clearHeld);
    document.addEventListener('visibilitychange', visibilityChange);
    const destroy = race.destroy;
    race.destroy = () => {
      window.removeEventListener('pointerup', onPointerRelease);
      window.removeEventListener('pointercancel', onPointerRelease);
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', clearHeld);
      document.removeEventListener('visibilitychange', visibilityChange);
      clearHeld();
      return destroy();
    };
    if (options.autoStart !== false) {
      [3, 2, 1].forEach((count, index) => setTimeout(() => {
        if (app.race !== race) return;
        toast(String(count)); audio('countdown');
      }, index * 1000));
      setTimeout(() => {
        if (app.race !== race) return;
        toast('GO!'); audio('go'); race.start();
      }, 3000);
    }
    return race;
  }
  function showResult(state, lesson) {
    window.KartFinish.render(root, state, {
      formatTime: fmt, bestTime: bestFor(lesson) || null, design: selectedDesign, color: selectedColor,
      onAgain: () => { window.KartAudio?.unlock?.(); window.KartAudio?.startMusic?.(); startRace(app.options); },
      onMenu: showMenu
    });
  }
  window.GrammarKartApp = { mount: startRace, showMenu, get race() { return app.race; } };
  window.addEventListener('pagehide', () => window.KartAudio?.destroy?.());
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || app.mode !== 'multi' || !app.race) return;
    if (event.data?.type === 'grammar-kart-opponents') app.race.setOpponents(event.data.players || []);
    if (event.data?.type === 'grammar-kart-start') app.race.start();
  });
  showMenu();
})();
