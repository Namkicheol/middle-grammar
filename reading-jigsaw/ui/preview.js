// ui/preview.js — 종이 학습지(조각 1장) 렌더러

import { applyBlanks, applyBlanksTeacher } from '../engine/blanks.js?v=20250526a';
import { toConsonants } from '../engine/hangul.js?v=20250526a';

// state.pieces[idx]를 학습지 HTML로
export function renderPaper(state, pieceIdx, mode = 'student') {
  const p = state.pieces[pieceIdx];
  if (!p) return '';

  const rangeSentences = state.sentences.slice(p.range[0], p.range[1]);
  const bodies = rangeSentences.filter(s => !s.isHeading && !s.koOnly);
  const vocabForPiece = state.vocabByPiece?.[pieceIdx] || [];
  const grammarPoints = collectGrammar(state, p);

  const isStudent = mode === 'student';
  const star = '★', empty = '☆';
  const stars = star.repeat(p.stars) + empty.repeat(3 - p.stars);

  return `
<article class="paper" data-mode="${mode}" data-piece="${pieceIdx}">
  <header class="paper-head">
    <div class="paper-letter">${p.label}</div>
    <div class="paper-title">
      <b>${escapeHtml(state.meta.lesson || 'L?')} · ${escapeHtml(state.meta.title || '본문')}</b>
      ${escapeHtml(p.heading || '')}
      <div class="meta">${escapeHtml(state.meta.textbook || '본문 직소')} · ${stars}</div>
    </div>
  </header>

  <aside class="paper-sidebar">
    <h4>우리가 할 일</h4>
    <ul>
      <li>단어 돌아가며 소리 내어 읽고 뜻 말하기</li>
      <li>영어 문장 끊어 읽기 표시하기</li>
      <li>돌아가며 해석 + 문법 포인트 정리</li>
      <li>조원이 모르면 적극 도와주기</li>
      <li>이해 안 된 부분 점검</li>
    </ul>
  </aside>

  ${renderVocab(vocabForPiece, isStudent, state.hangulHint)}
  ${renderSlow(bodies, state, isStudent)}
  ${renderQuestion(p, bodies, isStudent)}
  ${renderGrammar(grammarPoints, isStudent)}
</article>`;
}

function renderVocab(vocab, isStudent, hangulHint) {
  if (!vocab.length) return '';
  return `
<section class="paper-step">
  <div class="paper-step-label">
    <span class="paper-step-num">01</span>
    <span class="paper-step-name">Vocabulary</span>
    <span class="paper-step-aside">words ・ ${vocab.length}</span>
  </div>
  <ul class="vocab-grid">
    ${vocab.map(v => {
      const meaning = v.meaning || '';
      const display = isStudent
        ? (hangulHint === 'consonant' && meaning ? toConsonants(meaning) : '')
        : (meaning || '');
      return `<li><span class="w">${escapeHtml(v.word)}</span><span class="m${isStudent ? ' fill' : ''}">${escapeHtml(display) || '_____________'}</span></li>`;
    }).join('')}
  </ul>
</section>`;
}

function renderSlow(bodies, state, isStudent) {
  const rows = bodies.map(s => {
    const blanks = state.blanks?.get(s.id) || [];
    const en = isStudent
      ? applyBlanks(s.en, blanks)
      : applyBlanksTeacher(s.en, blanks);
    const note = pickNote(state, s);
    return `
    <div class="slow-row">
      <div class="slow-en">${en}</div>
      ${s.ko ? `<div class="slow-ko">${escapeHtml(s.ko)}</div>` : (isStudent ? '<div class="slow-ko">__________________________</div>' : '')}
      ${note ? `<div class="slow-note">${escapeHtml(note)}</div>` : ''}
    </div>`;
  }).join('');
  return `
<section class="paper-step">
  <div class="paper-step-label">
    <span class="paper-step-num">02</span>
    <span class="paper-step-name">Slow Reading</span>
    <span class="paper-step-aside">sentences ・ ${bodies.length}</span>
  </div>
  <div class="slow">${rows}</div>
</section>`;
}

function pickNote(state, sentence) {
  const hits = state.grammarMap?.get(sentence.id);
  if (!hits || !hits.length) return null;
  return hits.map(h => h.explain).slice(0, 1)[0];
}

function renderQuestion(piece, bodies, isStudent) {
  if (!bodies.length) return '';
  const target = bodies.slice().sort((a, b) => b.en.length - a.en.length)[0];
  const question = piece.aiQuestion || makeQuestion(target.en, piece.heading);
  const answerHtml = isStudent
    ? '<span class="answer-line"></span><span class="answer-line"></span>'
    : (piece.aiAnswer
        ? `<div class="ask answer">A. ${escapeHtml(piece.aiAnswer)}</div>`
        : '<span class="answer-line"></span><span class="answer-line"></span>');
  return `
<section class="paper-step">
  <div class="paper-step-label">
    <span class="paper-step-num">03</span>
    <span class="paper-step-name">Question</span>
  </div>
  <div class="q-card">
    <span class="qm">Q.</span>${escapeHtml(question)}
    ${answerHtml}
  </div>
</section>`;
}

function makeQuestion(sentence, heading) {
  // 간단 패턴: 주제 단어를 따서 묻는 형식
  const lower = sentence.toLowerCase();
  if (heading) {
    return `What does the text say about ${heading}?`;
  }
  if (/marketing strategy/i.test(sentence)) return 'How can marketing strategies influence shoppers?';
  if (/popular/i.test(sentence)) return 'Why does a product become popular?';
  return 'What is the main idea of this section?';
}

function renderGrammar(points, isStudent) {
  if (!points.length) return '';
  return `
<section class="paper-step">
  <div class="paper-step-label">
    <span class="paper-step-num">04</span>
    <span class="paper-step-name">Grammar Point</span>
  </div>
  ${points.map(p => `
    <div class="grammar-card">
      <div class="sentence">${highlightMatch(p.sentence, p.match)}</div>
      <div class="ask">밑줄 친 부분의 해석과 문법적 특징을 적어보세요.</div>
      ${isStudent
        ? '<span class="answer-line"></span><span class="answer-line"></span>'
        : `<div class="ask answer">정답: ${escapeHtml(p.explain)}</div>`}
    </div>
  `).join('')}
</section>`;
}

function highlightMatch(text, match) {
  if (!match) return escapeHtml(text);
  const idx = text.indexOf(match);
  if (idx < 0) return escapeHtml(text);
  return escapeHtml(text.slice(0, idx)) + '<u class="grammar-hl">' + escapeHtml(match) + '</u>' + escapeHtml(text.slice(idx + match.length));
}

function collectGrammar(state, piece) {
  const [a, b] = piece.range;
  const result = [];
  for (let i = a; i < b; i++) {
    const s = state.sentences[i];
    if (!s || s.isHeading) continue;
    const hits = state.grammarMap?.get(s.id);
    if (hits && hits.length) {
      result.push({
        sid: s.id,
        sentence: s.en,
        match: hits[0].match,
        label: hits[0].label,
        explain: hits[0].explain
      });
      if (result.length >= 3) break;
    }
  }
  return result;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
