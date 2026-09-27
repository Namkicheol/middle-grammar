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
  let pending = false;
  let startedAt = 0;
  let sendAt = 0;
  let lastSentLane = 0;
  let finishedShown = false;
  let wasHit = false;
  const fmt = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2,'0')}.${Math.floor((seconds % 1) * 10)}`;
  const send = message => window.parent.postMessage(message, origin);
  const audio = name => window.KartAudio?.play?.(name);
  function toast(message) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = message; $('toast-area').replaceChildren(t); setTimeout(() => t.remove(), 760); }
  function renderQuestion(question) {
    if (!question) { $('question').className = 'question waiting'; $('question').innerHTML = '<div><h2>다음 문제가 도착할 때까지 트랙에 집중!</h2></div>'; return; }
    const key = `${question.occurrenceIndex}:${question.id}`;
    if (questionKey === key) return;
    questionKey = key; pending = false;
    const box = $('question'); box.className = 'question'; box.replaceChildren();
    const head = document.createElement('div'); head.className = 'question-head'; head.textContent = `Q${question.occurrenceIndex + 1} · GRAMMAR BOOST`;
    const kor = document.createElement('p'); kor.textContent = question.kor || '알맞은 답을 고르세요.';
    const eng = document.createElement('h2'); eng.textContent = question.eng || '';
    const choices = document.createElement('div'); choices.className = 'choices';
    question.opts.forEach((choice, i) => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = `${i + 1}. ${choice}`;
      button.dataset.choice = choice;
      button.addEventListener('click', () => choose(choice)); choices.append(button);
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
    if (me.kart.hit && !wasHit) { audio('hit'); toast(me.kart.slipping ? '🍌 미끄러짐!' : '🚀 미사일 피격!'); }
    wasHit = Boolean(me.kart.hit);
    if (!race) {
      race = window.GrammarKart.createRace({ canvas: $('track'), lesson: '', mode: 'multi', playerId,
        kartDesign: me.kart.design, kartColor: me.kart.color,
        playerName: me.nickname || '나', onProgress: state => {
          $('speed').textContent = state.speed;
          $('meters').textContent = `${state.distance} / 1800 m`;
          $('bar').style.width = `${state.distance / 18}%`;
          $('time').textContent = fmt(Math.max(0, (Date.now() - startedAt) / 1000));
          const now = performance.now();
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
      design: p.kart?.design, kartColor: p.kart?.color, banana: p.kart?.banana
    })));
    $('speed').textContent = me.kart.speed;
    $('meters').textContent = `${me.kart.distance} / 1800 m`;
    $('bar').style.width = `${me.kart.distance / 18}%`;
    $('place').textContent = `#${me.rank}`;
    $('item').textContent = me.kart.charge >= 3 ? '⚡ BOOST READY' : `⚡ ${Math.round(me.kart.charge / 3 * 100)}%`;
    $('item').style.setProperty('--meter', `${Math.round(me.kart.charge / 3 * 100)}%`);
    $('item').classList.toggle('ready', me.kart.charge >= 3);
    $('weapon').textContent = me.kart.heldItem ? ({ banana: '🍌 바나나', missile: '🚀 미사일', shield: '🛡 방어막' }[me.kart.heldItem]) : '아이템 없음';
    $('weapon').disabled = !me.kart.heldItem;
    if (me.kart.finishedAt && !finishedShown) {
      finishedShown = true; questionKey = ''; pending = true;
      $('question').className = 'question waiting'; $('question').innerHTML = `<div><h2>🏁 결승선 통과! ${me.rank}위</h2><p>교사 화면에서 전체 순위를 확인하세요.</p></div>`;
      window.KartAudio?.stopMusic?.(); audio('finish'); send({ type: 'grammar-kart-finished' });
    } else if (!me.kart.finishedAt) renderQuestion(me.currentQuestion);
  }
  function bindControls() {
    const held = { left: false, right: false };
    const steer = () => race.setSteer((held.right ? 1 : 0) - (held.left ? 1 : 0));
    for (const dir of ['left','right']) {
      const button = $(dir);
      button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); held[dir] = true; steer(); window.KartAudio?.unlock?.(); window.KartAudio?.startMusic?.(); });
      for (const name of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(name, () => { held[dir] = false; steer(); });
    }
    $('item').addEventListener('click', () => { window.KartAudio?.unlock?.(); send({ type: 'grammar-kart-item-request' }); });
    $('weapon').addEventListener('click', () => { window.KartAudio?.unlock?.(); send({ type: 'grammar-kart-weapon-request' }); });
    window.addEventListener('keydown', e => {
      if (['ArrowLeft','a','A'].includes(e.key)) { e.preventDefault(); held.left = true; steer(); }
      if (['ArrowRight','d','D'].includes(e.key)) { e.preventDefault(); held.right = true; steer(); }
      if ('1234'.includes(e.key) && e.key.length === 1) document.querySelectorAll('.choices button')[Number(e.key)-1]?.click();
      if (e.code === 'Space') { e.preventDefault(); $('item').click(); }
      if (e.key === 'x' || e.key === 'X') { e.preventDefault(); $('weapon').click(); }
    });
    window.addEventListener('keyup', e => { if (['ArrowLeft','a','A'].includes(e.key)) held.left = false; if (['ArrowRight','d','D'].includes(e.key)) held.right = false; steer(); });
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
      audio(result.correct ? 'correct' : 'wrong'); if (result.correct) audio('boost');
      toast(result.correct ? '정답! BOOST!' : '다시 달려!');
    }
    if (data.type === 'grammar-kart-event') {
      audio(data.kind === 'hit' ? 'hit' : data.kind === 'pad' ? 'boost' : 'item');
      toast(({ hit: '충돌! 속도 감소', pad: 'SPEED PAD!', banana: '🍌 바나나 설치!', missile: '🚀 미사일 발사!', shield: '🛡 방어막!', star: 'BOOST +1' })[data.kind] || 'ITEM!');
    }
    if (data.type === 'grammar-kart-error') {
      pending = false;
      for (const button of document.querySelectorAll('.choices button')) button.disabled = false;
      toast(data.message || '잠시 후 다시 시도해 주세요.');
    }
  });
  window.addEventListener('pagehide', () => { race?.destroy(); window.KartAudio?.destroy?.(); });
  send({ type: 'grammar-kart-ready' });
})();
