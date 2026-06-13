// ui/preview.js — 종이 학습지(조각 1장) 렌더러  v=20250526s

import { applyBlanks, applyBlanksTeacher } from '../engine/blanks.js?v=20250526a';
import { toConsonants } from '../engine/hangul.js?v=20250526a';

// state.pieces[idx]를 학습지 HTML로
export function renderPaper(state, pieceIdx, mode = 'student') {
  const p = state.pieces[pieceIdx];
  if (!p) return '';

  const rangeSentences = state.sentences.slice(p.range[0], p.range[1]);
  const bodies = rangeSentences.filter(s => !s.isHeading && !s.koOnly && !s.deleted);
  const vocabForPiece = state.vocabByPiece?.[pieceIdx] || [];
  const grammarPoints = collectGrammar(state, p);

  const isStudent = mode === 'student';
  const star = '★', empty = '☆';
  const stars = star.repeat(p.stars) + empty.repeat(3 - p.stars);

  const lesson = state.meta.lesson?.trim();
  const title = state.meta.title?.trim();
  const headerTitle = [lesson, title].filter(Boolean).join(' · ') || '';

  return `
<article class="paper" data-mode="${mode}" data-piece="${pieceIdx}">
  <div class="paper-id-row">
    <span>학번: <span class="id-line"></span></span>
    <span>이름: <span class="id-line"></span></span>
  </div>
  <header class="paper-head">
    <div class="paper-letter">${p.label}</div>
    <div class="paper-title">
      ${headerTitle ? `<b>${escapeHtml(headerTitle)}</b>` : ''}
      ${escapeHtml(p.heading || '')}
      <div class="meta">${stars}</div>
    </div>
  </header>

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
    const blankType = state.blankType || 'ko'; // 'en' | 'ko'
    const showKo = state.showKo !== false;

    // English line
    let enHtml;
    if (!isStudent) {
      enHtml = `<div class="slow-en">${applyBlanksTeacher(s.en, blanks)}</div>`;
    } else if (blankType === 'en') {
      enHtml = `<div class="slow-en">${applyBlanks(s.en, blanks)}</div>`;
    } else {
      enHtml = `<div class="slow-en">${escapeHtml(s.en)}</div>`;
    }

    // Korean line
    let koHtml = '';
    if (!isStudent) {
      koHtml = s.ko ? `<div class="slow-ko">${escapeHtml(s.ko)}</div>` : '';
    } else if (blankType === 'en') {
      if (showKo) {
        koHtml = s.ko
          ? `<div class="slow-ko">${escapeHtml(s.ko)}</div>`
          : '<div class="slow-ko">__________________________</div>';
      }
    } else {
      // ko-blank mode: always show Korean with blanks
      if (!s.ko) {
        koHtml = '<div class="slow-ko">__________________________</div>';
      } else {
        const blanked = state.koBlanks?.get(s.id);
        if (blanked?.size) {
          const cloze = s.ko.split(' ').map((tok, i) =>
            blanked.has(i) ? '<span class="ko-gap">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>' : escapeHtml(tok)
          ).join(' ');
          koHtml = `<div class="slow-ko slow-ko-cloze">${cloze}</div>`;
        } else {
          koHtml = `<div class="slow-ko">${escapeHtml(s.ko)}</div>`;
        }
      }
    }

    const note = pickNote(state, s);
    return `
    <div class="slow-row">
      ${enHtml}
      ${koHtml}
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
      <div class="ask">${p.askTranslation
        ? 'Q. 본문 내용 중 아래의 밑줄 친 표현은 어떻게 해석하나요? 어떤 문법적 특징이 있나요?'
        : 'Q. 아래 밑줄 친 표현의 문법적 특징은 무엇인가요?'}</div>
      <div class="sentence">${highlightMatch(p.sentence, p.match)}</div>
      ${isStudent
        ? '<span class="answer-line"></span>'
        : `<div class="ask answer">${p.askTranslation && p.ko ? `<div class="answer-ko">해석: ${escapeHtml(p.ko)}</div>` : ''}A. ${escapeHtml(p.explain)}</div>`}
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
        ko: s.ko || '',
        match: hits[0].match,
        label: hits[0].label,
        explain: hits[0].explain,
        askTranslation: hits[0].askTranslation !== false
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
