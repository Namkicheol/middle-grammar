(function () {
  'use strict';

  const $ = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  };
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const defaultTime = seconds => {
    const value = Math.max(0, number(seconds));
    return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}.${Math.floor(value % 1 * 10)}`;
  };
  const timeText = (value, formatter) => {
    if (value == null) return '—';
    if (typeof formatter === 'function') return String(formatter(value));
    return typeof value === 'number' || (String(value).trim() !== '' && Number.isFinite(Number(value)))
      ? defaultTime(value) : String(value);
  };
  const displayRank = value => Number(value) > 0 ? String(Math.floor(Number(value))).padStart(2, '0') : '—';

  function render(root, state = {}, options = {}) {
    if (!root) return null;
    const rank = number(state.rank);
    const elapsed = state.elapsed;
    const page = $('section', 'kf-page');
    page.setAttribute('aria-label', '레이스 결과');
    const frame = $('div', 'kf-frame');
    const top = $('header', 'kf-top');
    const brand = $('div', 'kf-brand', 'GRAMMAR GRAND PRIX');
    top.append(brand);

    const layout = $('main', 'kf-layout');
    const summary = $('section', 'kf-summary');
    summary.append($('div', 'kf-kicker', 'RACE COMPLETE'));
    const hero = $('div', 'kf-hero');
    const rankBox = $('div', 'kf-rankbox');
    rankBox.append($('div', 'kf-rank-label', '최종 순위'));
    const rankLine = $('div', 'kf-rankline');
    rankLine.append($('strong', 'kf-rank', displayRank(rank)), $('span', 'kf-rank-unit', '위'));
    rankBox.append(rankLine);
    const preview = $('div', 'kf-preview');
    const canvas = $('canvas', 'kf-kart');
    canvas.width = 256; canvas.height = 256;
    canvas.setAttribute('aria-label', '완주한 카트');
    preview.append(canvas);
    hero.append(rankBox, preview);
    summary.append(hero);

    const metrics = $('div', 'kf-metrics');
    const time = $('div', 'kf-time');
    time.append($('span', 'kf-metric-label', '완주 기록'), $('strong', 'kf-time-value', timeText(elapsed, options.formatTime)));
    metrics.append(time);
    const facts = $('div', 'kf-facts');
    const correct = Number.isFinite(Number(state.correct)) ? Math.max(0, number(state.correct)) : null;
    const asked = Number.isFinite(Number(state.asked)) ? Math.max(0, number(state.asked)) : null;
    if (correct != null || asked != null) facts.append($('span', 'kf-fact', `정답 ${correct ?? '—'} / ${asked ?? '—'}`));
    const best = options.bestTime;
    if (best != null && best !== '') facts.append($('span', 'kf-fact', `BEST ${timeText(best, options.formatTime)}`));
    if (facts.childNodes.length) metrics.append(facts);
    summary.append(metrics);

    const board = $('section', 'kf-board');
    const boardHead = $('div', 'kf-board-head');
    boardHead.append($('h2', '', '결승 순위'), $('span', '', 'FINISH ORDER'));
    const list = $('ol', 'kf-list');
    const entries = Array.isArray(state.standings) ? state.standings : [];
    let visible = entries.map((entry, index) => ({ entry: entry || {}, index }));
    if (visible.length > 5) {
      const meIndex = visible.findIndex(item => item.entry.me);
      visible = visible.slice(0, 4);
      if (meIndex >= 4) visible.push({ gap: true }, { entry: entries[meIndex] || {}, index: meIndex });
    }
    if (!visible.length) visible = [{ entry: { name: '나', me: true, elapsed }, index: Math.max(0, Math.floor(rank) - 1) }];
    visible.forEach(item => {
      if (item.gap) { list.append($('li', 'kf-gap', '···')); return; }
      const entry = item.entry;
      const row = $('li', `kf-row${entry.me ? ' is-me' : ''}`);
      row.append($('span', 'kf-place', String(item.index + 1).padStart(2, '0')));
      row.append($('span', 'kf-name', entry.me ? '나' : (entry.name || `레이서 ${item.index + 1}`)));
      const result = entry.elapsed != null ? timeText(entry.elapsed, options.formatTime)
        : entry.distance != null ? `${Math.max(0, Math.round(number(entry.distance)))} m` : '완주';
      row.append($('span', 'kf-row-result', result));
      list.append(row);
    });
    board.append(boardHead, list);
    layout.append(summary, board);

    const actions = $('nav', 'kf-actions');
    const again = $('button', 'kf-again', '다시 달리기');
    again.type = 'button';
    again.addEventListener('click', () => options.onAgain?.());
    const bottom = $('div', 'kf-secondary-actions');
    const menu = $('button', 'kf-menu', '단원 선택');
    menu.type = 'button';
    menu.addEventListener('click', () => options.onMenu?.());
    const bottomHub = $('a', 'kf-hub-link', '게임 허브로');
    bottomHub.href = '../game/';
    bottom.append(menu, bottomHub);
    actions.append(again, bottom);
    frame.append(top, layout, actions);
    page.append(frame);
    root.replaceChildren(page);

    if (window.GrammarKart?.paintShowcase) {
      window.GrammarKart.paintShowcase(canvas, options.design || 'teal', options.color || 'cyan');
    }
    return page;
  }

  function overlay(trackWrap, state = {}) {
    if (!trackWrap) return null;
    trackWrap.querySelector('.kf-overlay')?.remove();
    const card = $('aside', 'kf-overlay');
    card.setAttribute('role', 'status');
    card.setAttribute('aria-live', 'polite');
    const rank = number(state.rank);
    card.append($('div', 'kf-overlay-label', '결승선 통과'));
    const line = $('div', 'kf-overlay-main');
    line.append($('strong', 'kf-overlay-rank', rank > 0 ? `${Math.floor(rank)}위` : '완주'),
      $('span', 'kf-overlay-time', timeText(state.elapsed)));
    card.append(line, $('p', 'kf-overlay-note', '교사 화면에서 최종 순위를 확인하세요.'));
    trackWrap.append(card);
    return card;
  }

  window.KartFinish = { render, overlay };
})();
