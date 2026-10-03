(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const origin = (() => {
    try {
      const url = new URL(new URLSearchParams(location.search).get('parentOrigin'));
      return ['http:', 'https:'].includes(url.protocol) ? url.origin : location.origin;
    } catch (_) { return location.origin; }
  })();
  let race = null;
  let playerId = '';
  let questionKey = '';
  let questionUntil = 0;
  let pending = false;
  let startedAt = 0;
  let sendAt = 0;
  let lastSentLane = 0;
  let finishedShown = false;
  let wasHit = false;
  let lastCueAt = 0;
  let lastRoadsideCounts = null;
  const fmt = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2,'0')}.${Math.floor((seconds % 1) * 10)}`;
  const send = message => window.parent.postMessage(message, origin);
  const audio = name => window.KartAudio?.play?.(name);
  function toast(message, duration = 760) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = message; t.style.animationDuration = `${duration}ms`; $('toast-area').replaceChildren(t); setTimeout(() => t.remove(), duration); }
  function itemGuide() {
    const make = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
    const details = make('details', 'item-guide');
    const summary = make('summary', '', '아이템 설명');
    const panel = make('div', 'item-guide-panel');
    panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', '레이스 아이템 설명');
    const header = make('div', 'item-guide-header');
    header.append(make('h2', '', '아이템 안내'));
    const close = make('button', 'item-guide-close', '닫기'); close.type = 'button';
    close.addEventListener('click', () => { details.open = false; summary.focus(); });
    header.append(close); panel.append(header);
    const list = make('ul', '');
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
      const row = make('li', ''); const label = make('strong', '', name);
      row.append(label, document.createTextNode(` · ${explanation}`)); list.append(row);
    });
    panel.append(list); details.append(summary, panel);
    summary.setAttribute('aria-label', '아이템 설명 열기 또는 닫기');
    details.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !details.open) return;
      event.preventDefault(); details.open = false; summary.focus();
    });
    return details;
  }
  function setupRaceHint() {
    const existing = document.querySelector('.hint');
    if (!existing) return;
    const hint = document.createElement('div'); hint.className = 'hint';
    const keyboard = document.createElement('span'); keyboard.className = 'hint-keyboard'; keyboard.textContent = '← → 조향 · 1~4 답안 레인 · Space 부스터 · X 아이템';
    const pickups = document.createElement('span'); pickups.className = 'hint-pickups'; pickups.textContent = '⭐/🪙 충전 +1 · PAD 부스트 +1.6초 · ? 바나나';
    hint.append(keyboard, pickups, itemGuide()); existing.replaceWith(hint);
  }
  function renderQuestion(question) {
    if (!question) { race?.setGateQuestion(null); questionKey = ''; $('question').hidden = true; document.querySelector('.race-shell')?.classList.remove('question-active'); return; }
    const key = `${question.occurrenceIndex}:${question.id}`;
    if (questionKey === key) return;
    questionKey = key; pending = false; race?.setGateQuestion(question); questionUntil = performance.now() + 16000;
    $('question').hidden = false; document.querySelector('.race-shell')?.classList.add('question-active');
    const box = $('question'); box.className = 'question'; box.replaceChildren();
    const head = document.createElement('div'); head.className = 'question-head';
    head.innerHTML = `<span>Q${question.occurrenceIndex + 1} · 답안 레인으로 이동</span><span class="question-timer">판정선 접근 중</span>`;
    const kor = document.createElement('p'); kor.textContent = question.kor || '알맞은 답을 고르세요.';
    const eng = document.createElement('h2'); eng.textContent = question.eng || '';
    const choices = document.createElement('div'); choices.className = 'choices';
    question.opts.forEach((choice, i) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = `${'ABCD'[i]}. ${choice}`;
      button.dataset.choice = choice;
      button.addEventListener('click', () => race?.selectGateLane(i)); choices.append(button);
    });
    box.append(head, kor, eng, choices);
  }
  function choose(choice) {
    if (pending || !questionKey || !race) return;
    pending = true; window.KartAudio?.unlock?.(); window.KartAudio?.startMusic?.();
    const [index, ...id] = questionKey.split(':');
    send({ type: 'grammar-kart-answer-request', questionId: id.join(':'), occurrenceIndex: Number(index), answer: choice });
    for (const b of document.querySelectorAll('.choices button')) b.disabled = true;
  }
  function sync(room) {
    if (!room || room.mode !== 'grammar_kart') return;
    const me = room.self;
    if (!me?.kart) return;
    const roadside = { stars: Number(me.kart.stars) || 0, pads: Number(me.kart.pads) || 0, heldItem: me.kart.heldItem || '' };
    if (lastRoadsideCounts) {
      const starsFound = roadside.stars - lastRoadsideCounts.stars;
      if (starsFound > 0) toast(me.kart.charge >= 3 ? '부스트 준비! 3/3' : `⭐/🪙 충전 +${starsFound}`, 1400);
      else if (roadside.pads > lastRoadsideCounts.pads) toast('SPEED PAD · 부스트 +1.6초', 1400);
      else if (!lastRoadsideCounts.heldItem && roadside.heldItem === 'banana') toast('상자 · 🍌 바나나 획득', 1400);
    }
    lastRoadsideCounts = roadside;
    if (me.kart.hit && !wasHit && !me.kart.lastCue) { audio('hit'); toast(me.kart.slipping ? '🍌 미끄러짐!' : '🚀 미사일 피격!'); }
    wasHit = Boolean(me.kart.hit);
    if (!race) {
      race = window.GrammarKart.createRace({ canvas: $('track'), lesson: '', mode: 'multi', playerId,
        kartDesign: me.kart.design, kartColor: me.kart.color,
        playerName: me.nickname || '나', onGateChoice: choice => choose(choice), onEvent: event => { if (['drift','offroad'].includes(event.kind)) audio('skid'); }, onProgress: state => {
          window.KartAudio?.setEngineSpeed?.(state.speed, state.boosted);
          $('speed').textContent = state.speed;
          $('meters').textContent = `${state.distance} / 1800 m`;
          $('bar').style.width = `${state.distance / 18}%`;
          $('time').textContent = fmt(Math.max(0, (Date.now() - startedAt) / 1000));
          const now = performance.now();
          if (questionKey && !pending) {
            const seconds = Math.max(0, Math.ceil((questionUntil - now) / 1000));
            const timer = document.querySelector('.question-timer'); if (timer) timer.textContent = `판정선 ${state.gateRemaining ?? seconds}초`;
            document.querySelectorAll('.choices button').forEach((button,index)=>button.classList.toggle('lane-selected',index===state.answerLane));
          }
          if (!state.finished && (now - sendAt > 900 || (Math.abs(state.lane - lastSentLane) > 0.03 && now - sendAt > 220))) {
            sendAt = now; lastSentLane = state.lane;
            send({ type: 'grammar-kart-move', lane: state.lane });
          }
        }
      });
      race.start();
      bindControls();
    }
    startedAt = room.startedAt || Date.now();
    race.setRemoteState(me.kart);
    race.setOpponents((room.leaderboard || []).filter(p => p.playerId !== playerId).map(p => ({
      id: p.playerId, name: p.nickname, distance: p.kart?.distance || 0, lane: p.kart?.lane || 0,
      design: p.kart?.design, kartColor: p.kart?.color, banana: p.kart?.banana, lastCue: p.kart?.lastCue, hit: p.kart?.hit
    })));
    if (me.kart.lastCue) {
      race.playCue(me.kart.lastCue);
      if (me.kart.lastCue.at !== lastCueAt) {
        lastCueAt = me.kart.lastCue.at;
        const cue = me.kart.lastCue.kind;
        if (['missile_hit','banana_hit','contact'].includes(cue)) { audio(cue === 'banana_hit' ? 'skid' : 'hit'); toast(cue === 'banana_hit' ? '🍌 미끄러짐!' : cue === 'contact' ? '💥 카트 충돌!' : '🚀 미사일 피격!'); }
        else if (cue === 'shield_block') { audio('item'); toast('🛡 방어 성공!'); }
      }
    }
    $('speed').textContent = me.kart.speed;
    $('meters').textContent = `${me.kart.distance} / 1800 m`;
    $('bar').style.width = `${me.kart.distance / 18}%`;
    $('place').textContent = `${me.rank} / ${(room.leaderboard || []).length}`;
    $('item').textContent = me.kart.boostStock ? `부스터 ×${me.kart.boostStock}` : me.kart.charge >= 3 ? '부스터 준비' : `${Math.round(me.kart.charge / 3 * 100)}%`;
    $('item').style.setProperty('--meter', `${Math.round(me.kart.charge / 3 * 100)}%`);
    $('item').classList.toggle('ready', me.kart.boostStock > 0 || me.kart.charge >= 3);
    $('weapon').textContent = me.kart.heldItem ? ({ banana: '바나나', missile: '미사일', shield: '방어막' }[me.kart.heldItem]) : '아이템 없음';
    $('weapon').disabled = !me.kart.heldItem;
    $('missile').textContent = `미사일 ${me.kart.missiles || 0}`; $('missile').disabled = !me.kart.missiles;
    $('shield').textContent = `방어막 ${me.kart.shields || 0}`; $('shield').disabled = !me.kart.shields;
    if (me.kart.finishedAt && !finishedShown) {
      finishedShown = true; questionKey = ''; pending = true;
      $('question').hidden = true; document.querySelector('.race-shell')?.classList.remove('question-active');
      window.KartFinish.overlay(document.querySelector('.track-wrap'), { rank: me.rank, elapsed: (me.kart.finishedAt - startedAt) / 1000 });
      window.KartAudio?.stopMusic?.(); audio('finish'); send({ type: 'grammar-kart-finished' });
    } else if (!me.kart.finishedAt) renderQuestion(me.currentQuestion);
  }
  function bindControls() {
    document.querySelector('.track-wrap').append($('left'), $('right'), $('question'));
    const missile = document.createElement('button'); missile.id='missile'; missile.className='control weapon'; missile.type='button'; missile.textContent='미사일 0'; missile.disabled=true;
    const shield = document.createElement('button'); shield.id='shield'; shield.className='control weapon'; shield.type='button'; shield.textContent='방어막 0'; shield.disabled=true;
    document.querySelector('.controls').append(missile, shield);
    const boundRace = race;
    const pointerDirections = new Map();
    const keyHolds = { left: new Set(), right: new Set() };
    const directionForKey = key => ['ArrowLeft', 'a', 'A'].includes(key) ? 'left' : ['ArrowRight', 'd', 'D'].includes(key) ? 'right' : '';
    const isHeld = dir => keyHolds[dir].size > 0 || [...pointerDirections.values()].includes(dir);
    const steer = () => boundRace.setSteer((isHeld('right') ? 1 : 0) - (isHeld('left') ? 1 : 0));
    const clearHeld = () => {
      pointerDirections.clear();
      keyHolds.left.clear(); keyHolds.right.clear();
      steer();
    };
    const onPointerDown = dir => e => {
      e.preventDefault();
      pointerDirections.set(e.pointerId, dir);
      e.currentTarget.setPointerCapture(e.pointerId);
      steer();
      window.KartAudio?.unlock?.(); window.KartAudio?.startMusic?.();
    };
    const onPointerRelease = e => {
      if (pointerDirections.delete(e.pointerId)) steer();
    };
    const controls = [];
    for (const dir of ['left','right']) {
      const button = $(dir);
      const pointerdown = onPointerDown(dir);
      button.addEventListener('pointerdown', pointerdown);
      button.addEventListener('lostpointercapture', onPointerRelease);
      controls.push({ button, pointerdown });
    }
    const keydown = e => {
      if (race !== boundRace) return;
      const direction = directionForKey(e.key);
      if (direction) { e.preventDefault(); keyHolds[direction].add(e.key); steer(); }
      if ('1234'.includes(e.key) && e.key.length === 1) document.querySelectorAll('.choices button')[Number(e.key)-1]?.click();
      if (e.code === 'Space') { e.preventDefault(); $('item').click(); }
      if (e.key === 'x' || e.key === 'X') { e.preventDefault(); (missile.disabled ? shield.disabled ? $('weapon') : shield : missile).click(); }
    };
    const keyup = e => {
      const direction = directionForKey(e.key);
      if (direction && keyHolds[direction].delete(e.key)) steer();
    };
    const visibilityChange = () => { if (document.visibilityState === 'hidden') clearHeld(); };
    window.addEventListener('pointerup', onPointerRelease);
    window.addEventListener('pointercancel', onPointerRelease);
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', clearHeld);
    document.addEventListener('visibilitychange', visibilityChange);
    $('item').addEventListener('click', () => { window.KartAudio?.unlock?.(); send({ type: 'grammar-kart-item-request' }); });
    $('weapon').addEventListener('click', () => { window.KartAudio?.unlock?.(); send({ type: 'grammar-kart-weapon-request', weapon: race.getState().heldItem }); });
    missile.addEventListener('click', () => { window.KartAudio?.unlock?.(); send({ type: 'grammar-kart-weapon-request', weapon: 'missile' }); });
    shield.addEventListener('click', () => { window.KartAudio?.unlock?.(); send({ type: 'grammar-kart-weapon-request', weapon: 'shield' }); });
    const cleanup = () => {
      window.removeEventListener('pointerup', onPointerRelease);
      window.removeEventListener('pointercancel', onPointerRelease);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', clearHeld);
      document.removeEventListener('visibilitychange', visibilityChange);
      controls.forEach(({ button, pointerdown }) => {
        button.removeEventListener('pointerdown', pointerdown);
        button.removeEventListener('lostpointercapture', onPointerRelease);
      });
      clearHeld();
    };
    const destroy = boundRace.destroy;
    boundRace.destroy = () => { cleanup(); return destroy.call(boundRace); };
  }
  window.addEventListener('message', e => {
    if (e.origin !== origin) return;
    const data = e.data || {};
    if (data.type === 'grammar-kart-init') { playerId = data.playerId; sync(data.room); }
    if (data.type === 'grammar-kart-mute') window.KartAudio?.setMuted?.(Boolean(data.muted));
    if (data.type === 'grammar-kart-state') sync(data.room);
    if (data.type === 'grammar-kart-answer-result') {
      pending = false; questionKey = '';
      const result = data.result || {};
      audio(result.correct ? 'correct' : 'wrong');
      toast(result.correct ? `정답! ${({ boost: '부스터', missile: '미사일', shield: '방어막' })[result.reward] || '아이템'} 획득` : '계속 달려!');
    }
    if (data.type === 'grammar-kart-event') {
      audio(data.kind === 'banana_hit' ? 'skid' : data.kind === 'missile' ? 'missile' : ['hit','contact'].includes(data.kind) ? 'hit' : data.kind === 'pad' ? 'boost' : 'item');
      toast(({ hit: '충돌! 속도 감소', pad: 'SPEED PAD!', banana: '🍌 바나나 설치!', missile: '🚀 미사일 발사!', shield: '🛡 방어막!', star: 'BOOST +1' })[data.kind] || 'ITEM!');
    }
    if (data.type === 'grammar-kart-error') {
      pending = false;
      for (const button of document.querySelectorAll('.choices button')) button.disabled = false;
      if (race?.getState().gatePending && !$('gate-retry')) {
        const retry = document.createElement('button'); retry.id = 'gate-retry'; retry.type = 'button';
        retry.className = 'gate-retry'; retry.textContent = '답안 다시 보내기';
        retry.addEventListener('click', () => { if (race.retryGate()) retry.remove(); });
        $('question').append(retry);
      }
      toast(data.message || '잠시 후 다시 시도해 주세요.');
    }
  });
  window.addEventListener('pagehide', () => { race?.destroy(); window.KartAudio?.destroy?.(); });
  setupRaceHint();
  send({ type: 'grammar-kart-ready' });
})();
