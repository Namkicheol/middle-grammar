// app.js — Jigsaw Studio 메인 컨트롤러

import { parse } from './engine/parser.js?v=20250526a';
import { enrichWithAI, extractGrammarCandidates, translateSentences } from './engine/ai.js?v=20260613a';
import { autoSplit, insertBoundary, removeBoundary } from './engine/split.js?v=20250526a';
import { extract, pickForPiece } from './engine/vocab.js?v=20260613a';
import { detectAll } from './engine/grammar.js?v=20250526a';
import { suggest as suggestBlanks } from './engine/blanks.js?v=20250526a';
import { renderPaper } from './ui/preview.js?v=20250526s';

const STORAGE_KEY = 'jigsaw-studio:v1';
const SAMPLE_URL = 'assets/samples/donga-l4.txt';

// ───── State ─────
const state = {
  step: 1,
  mode: 'student',       // student | teacher
  hangulHint: 'consonant', // off | consonant
  blankType: 'ko',       // 'en' | 'ko' — Step 3에서 선택
  showKo: true,          // boolean — 학생용 한국어 번역 표시 여부
  styleBase: 'english2',
  meta: { title: '', lesson: '' },
  grammarSelected: {},    // "label-ci" → true/false
  source: '',
  sentences: [],
  pieces: [],
  vocab: [],              // 전체 후보
  vocabByPiece: {},       // pieceIdx → [{ word, meaning, count }]
  grammarMap: new Map(),  // sid → hits[]
  blanks: new Map(),      // sid → [{text,start,end}]
  koBlanks: new Map(),    // sid → Set<tokenIdx>
  selectedPiece: 0,
  loadedSample: false,
  apiKey: localStorage.getItem('jigsaw-api-key') || '',
  aiLoading: false,
  grammarTarget: '',
  grammarCandidates: null,
  grammarLoading: false
};

// ───── Routing ─────
const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

function go(step) {
  state.step = step;
  $$('.step').forEach((el, i) => {
    el.classList.toggle('active', i + 1 === step);
    el.classList.toggle('done', i + 1 < step);
  });
  $('.rail-foot .ratio').textContent = `${step} / 5`;
  renderEdit();
  renderPrev();
  persist();
}

// ───── Step Views ─────
function renderEdit() {
  const editEl = $('.edit');
  switch (state.step) {
    case 1: return editEl.innerHTML = viewUpload();
    case 2: return editEl.innerHTML = viewSplit();
    case 3: return editEl.innerHTML = viewBlanks();
    case 4: return editEl.innerHTML = viewPreview();
    case 5: return editEl.innerHTML = viewExport();
  }
}

function renderPrev() {
  const prevEl = $('.prev');
  if (!state.pieces.length) {
    prevEl.innerHTML = `
      <div class="prev-head">
        <div class="prev-title">미리보기 <em>(자료 입력 후 표시)</em></div>
      </div>
      <div style="padding:60px 20px;text-align:center;color:var(--ink-mute);font-style:italic;font-family:var(--font-display);">
        <div style="font-size:3rem;margin-bottom:14px;">¶</div>
        본문이 들어오면 첫 조각이 여기에 종이로 나타납니다.
      </div>`;
    return;
  }
  const modeToggleHtml = `
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
      <div class="prev-toggle">
        <button class="${state.mode === 'student' ? 'on' : ''}" data-mode="student">학생</button>
        <button class="${state.mode === 'teacher' ? 'on' : ''}" data-mode="teacher">교사</button>
      </div>
      <div class="prev-toggle">
        <button class="${state.showKo ? 'on' : ''}" data-ko="on">해석</button>
        <button class="${!state.showKo ? 'on' : ''}" data-ko="off">해석OFF</button>
      </div>
      <div class="prev-toggle">
        <button class="${state.hangulHint === 'consonant' ? 'on' : ''}" data-hint="consonant">초성</button>
        <button class="${state.hangulHint === 'off' ? 'on' : ''}" data-hint="off">초성OFF</button>
      </div>
    </div>`;

  if (state.selectedPiece === -1 || state.step === 3) {
    const allPapers = state.pieces.map((_, i) => renderPaper(state, i, state.mode))
      .join('<hr style="border:none;border-top:1px dashed var(--paper-edge);margin:20px 0;">');
    prevEl.innerHTML = `
      <div class="prev-head">
        <div class="prev-title"><b>전체 조각</b> 미리보기 <em>· ${state.mode === 'student' ? '학생용' : '교사용'}</em></div>
        ${modeToggleHtml}
      </div>
      ${allPapers}
    `;
    bindPrevToggles();
    return;
  }

  const idx = Math.min(state.selectedPiece, state.pieces.length - 1);
  const p = state.pieces[idx];
  prevEl.innerHTML = `
    <div class="prev-head">
      <div class="prev-title"><b>조각 ${p.label}</b> 미리보기 <em>· ${state.mode === 'student' ? '학생용' : '교사용'}</em></div>
      ${modeToggleHtml}
    </div>
    ${renderPaper(state, idx, state.mode)}
  `;
  bindPrevToggles();
}

function bindPrevToggles() {
  $$('.prev-toggle button[data-mode]').forEach(b => b.addEventListener('click', () => {
    state.mode = b.dataset.mode; renderPrev();
  }));
  $$('.prev-toggle button[data-ko]').forEach(b => b.addEventListener('click', () => {
    state.showKo = b.dataset.ko === 'on'; renderPrev();
  }));
  $$('.prev-toggle button[data-hint]').forEach(b => b.addEventListener('click', () => {
    state.hangulHint = b.dataset.hint; renderPrev();
  }));
}

// ─── Step 1: Upload ───
function viewUpload() {
  return `
    <div class="edit-head">
      <div>
        <div class="edit-step-tag">Step 1 · Source</div>
        <h1 class="edit-title">본문을 <em>붙여넣거나 업로드</em></h1>
      </div>
      <div class="edit-meta">
        <div class="edit-meta-item"><span>format</span><b>text</b></div>
      </div>
    </div>

    <div class="upload-zone">
      <div class="upload-meta" style="grid-template-columns:2fr 1fr;">
        <label class="meta-field">
          <span>제목</span>
          <input id="m-title" type="text" placeholder="본문 제목" value="${escapeAttr(state.meta.title)}">
        </label>
        <label class="meta-field">
          <span>Lesson</span>
          <input id="m-lesson" type="text" placeholder="Lesson 1" value="${escapeAttr(state.meta.lesson)}">
        </label>
      </div>

      <textarea id="source-input" class="upload-input" placeholder="본문을 여기에 붙여넣으세요. 빈 줄로 문단을 구분하면 더 정확히 분할됩니다.&#10;&#10;Be a Smart Shopper!&#10;&#10;Do you think you are a smart shopper?&#10;...">${escapeHtml(state.source)}</textarea>

      <input type="file" id="file-input" accept=".txt,.pdf" style="display:none">
      <div class="upload-actions">
        <button class="btn" id="open-file-btn">📂 파일 열기</button>
        <button class="btn" id="load-sample">샘플 <span style="font-family:var(--font-mono);font-size:.66rem;color:var(--ink-mute);margin-left:4px;">동아윤 L4</span></button>
        <div style="flex:1"></div>
        <button class="btn btn-primary" id="go-clean">분할로 진행 →</button>
      </div>
    </div>
  `;
}

// ─── Step 2: Split ───
function viewSplit() {
  return `
    <div class="edit-head">
      <div>
        <div class="edit-step-tag">Step 2 · Section split</div>
        <h1 class="edit-title">본문을 조각으로 <em>나누기</em></h1>
      </div>
      ${state.aiLoading ? `<div class="ai-loading">AI가 단어 뜻·질문·문법 포인트를 생성 중...</div>` : ''}
      <div class="edit-meta">
        <div class="edit-meta-item"><span>sentences</span><b>${state.sentences.filter(s=>!s.isHeading).length}</b></div>
        <div class="edit-meta-item"><span>pieces</span><b>${state.pieces.length}</b></div>
        <div class="edit-meta-item"><span>avg ★</span><b>${(state.pieces.reduce((a,p)=>a+p.stars,0)/state.pieces.length).toFixed(1)}</b></div>
      </div>
    </div>

    ${state.pieces.map((p, idx) => {
      const editor = renderPieceEditor(p, idx);
      const sep = idx < state.pieces.length - 1
        ? `<div class="divider"><span>${p.label} / ${state.pieces[idx+1].label} 경계</span></div>`
        : '';
      return editor + sep;
    }).join('')}

    <div class="step-actions">
      <button class="btn" id="back-upload">← 다시 입력</button>
      <div style="flex:1"></div>
      <button class="btn btn-primary" id="go-blanks">빈칸·문법 →</button>
    </div>
  `;
}

function renderPieceEditor(p, idx) {
  const rangeSentences = state.sentences.slice(p.range[0], p.range[1]);
  const star = '★', empty = '☆';
  return `
    <section class="piece" data-piece="${idx}">
      <div class="piece-bar">
        <div class="piece-letter">${p.label}</div>
        <div class="piece-info">
          <div class="piece-info-top">${star.repeat(p.stars)}${empty.repeat(3-p.stars)} · ${p.sentenceCount} sentences · ${p.wordCount} words${p.heading ? ' · <em>' + escapeHtml(p.heading) + '</em>' : ''}</div>
          ${p.heading ? `<div class="piece-heading">${escapeHtml(p.heading)}</div>` : ''}
        </div>
        <div class="piece-stars">
          ${[1,2,3].map(n => `<span class="${n<=p.stars?'':'empty'}" data-set-stars="${idx}:${n}">★</span>`).join('')}
        </div>
        <div class="piece-actions">
          ${idx > 0 ? `<span class="pa" data-merge="${idx-1}">⤚ 앞 조각과 합치기</span>` : ''}
        </div>
      </div>

      ${rangeSentences.filter(s => !s.deleted).map((s, i) => `
        <div class="sent ${s.isHeading ? 'heading' : ''}" data-sid="${s.id}">
          <div class="sent-num">${s.isHeading ? '·' : (s.id + 1)}</div>
          <div style="flex:1">
            <div class="sent-en">${escapeHtml(s.en)}</div>
            ${s.ko ? `<div class="sent-ko">${escapeHtml(s.ko)}</div>` : ''}
          </div>
          ${!s.isHeading ? `<button class="sent-del-btn" data-del-sid="${s.id}" title="문장 삭제">✕</button>` : ''}
        </div>
        ${i < rangeSentences.filter(sx => !sx.deleted).length - 1
          ? `<div class="cut-line"><button class="cut-btn" data-split="${s.id + 1}">✂ 여기서 나누기</button></div>`
          : ''}
      `).join('')}
    </section>
  `;
}

// ─── Step 4: Blanks + Grammar ───
function viewBlanks() {
  const all = [];
  let nb = 0;
  state.sentences.forEach(s => {
    if (!s.isHeading && state.blanks.has(s.id)) {
      nb += state.blanks.get(s.id).length;
    }
  });

  return `
    <div class="edit-head">
      <div>
        <div class="edit-step-tag">Step 3 · Blanks · Grammar</div>
        <h1 class="edit-title">빈칸과 문법 포인트 <em>표시</em></h1>
      </div>
      <div class="edit-meta">
        <div class="edit-meta-item"><span>blanks</span><b>${nb}</b></div>
        <div class="edit-meta-item"><span>grammar</span><b>${state.grammarMap.size}</b></div>
      </div>
    </div>

    <div class="blank-type-bar">
      <span class="blank-type-label">출제 유형 선택</span>
      <div class="prev-toggle">
        <button data-btype="en" class="${state.blankType === 'en' ? 'on' : ''}">영어 빈칸</button>
        <button data-btype="ko" class="${state.blankType === 'ko' ? 'on' : ''}">한글 빈칸</button>
      </div>
    </div>

    <p style="font-family:var(--font-display);font-style:italic;color:var(--ink-3);font-size:.94rem;margin-bottom:18px;">
      영어빈칸: 더블클릭으로 단어 선택 · 한글빈칸: 한국어 어절 더블클릭
    </p>

    ${state.pieces.map((p, idx) => renderBlanksPiece(p, idx)).join('')}

    <div class="claude-panel">
      <div class="claude-panel-head">
        <span class="claude-panel-title">문법 포인트 선택</span>
        <span class="claude-panel-desc">AI가 본문에서 후보를 추출하면 원하는 것만 선택하세요</span>
      </div>
      <div class="claude-panel-row" style="align-items:center;gap:10px;flex-wrap:wrap;">
        <label style="font-family:var(--font-mono);font-size:.76rem;font-weight:700;color:var(--ink-3);white-space:nowrap;">타겟 문법</label>
        <input id="grammar-target" class="vocab-edit-meaning" style="flex:1;min-width:160px;max-width:280px;"
               placeholder="예: 관계대명사, 수동태, to부정사 …" value="${escapeAttr(state.grammarTarget || '')}">
      </div>
      ${state.grammarLoading
        ? `<div class="claude-panel-row"><span style="font-family:var(--font-mono);font-size:.8rem;color:var(--moss);">AI가 문법 포인트를 분석 중...</span></div>`
        : state.grammarCandidates
          ? renderGrammarCandidates()
          : `<div class="claude-panel-row"><button class="btn btn-primary" id="run-ai">✨ 문법 포인트 추출</button></div>`}
    </div>

    <div class="step-actions">
      <button class="btn" id="back-split">← 분할</button>
      <div style="flex:1"></div>
      <button class="btn btn-primary" id="go-preview">미리보기 →</button>
    </div>
  `;
}

function renderBlanksPiece(p, idx) {
  const rangeSentences = state.sentences.slice(p.range[0], p.range[1]).filter(s => !s.isHeading && !s.deleted);
  const vocabList = state.vocabByPiece[idx] || [];
  const vocabHtml = vocabList.length ? `
    <div class="vocab-edit">
      <div class="vocab-edit-label">단어장 — 뜻 입력</div>
      ${vocabList.map((v, vi) => `
        <div class="vocab-edit-row">
          <span class="vocab-edit-word">${escapeHtml(v.word)}</span>
          <input class="vocab-edit-meaning" data-piece="${idx}" data-vocab="${vi}"
                 placeholder="한국어 뜻" value="${escapeAttr(v.meaning || '')}">
        </div>
      `).join('')}
    </div>
  ` : '';
  return `
    <section class="piece">
      <div class="piece-bar">
        <div class="piece-letter">${p.label}</div>
        <div class="piece-info">
          <div class="piece-heading">${escapeHtml(p.heading || '제목 없음')}</div>
        </div>
      </div>
      ${vocabHtml}
      ${rangeSentences.map(s => `
        <div class="sent" data-sid="${s.id}">
          <div class="sent-num">${s.id + 1}</div>
          <div style="flex:1">
            <div class="sent-en" data-en="${escapeAttr(s.en)}">${renderInlineMarkup(s)}</div>
            ${s.ko ? `<div class="sent-ko-tokens">${renderKoTokens(s)}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </section>
  `;
}

function renderInlineMarkup(s) {
  const blanks = state.blanks.get(s.id) || [];
  const grammar = state.grammarMap.get(s.id) || [];
  // 표시: blanks + grammar match를 위치별로 합쳐 mark
  const marks = [];
  for (const b of blanks) marks.push({ type: 'blk', start: b.start, end: b.end, text: b.text });
  for (const g of grammar) {
    const idx = s.en.indexOf(g.match);
    if (idx >= 0) marks.push({ type: 'gp', start: idx, end: idx + g.match.length, text: g.match, label: g.label });
  }
  marks.sort((a, b) => a.start - b.start);
  // 겹치면 blk 우선
  const filtered = [];
  for (const m of marks) {
    if (filtered.some(f => !(m.end <= f.start || f.end <= m.start))) continue;
    filtered.push(m);
  }

  let out = '';
  let cursor = 0;
  for (const m of filtered) {
    out += escapeHtml(s.en.slice(cursor, m.start));
    if (m.type === 'blk') {
      out += `<span class="blk">${escapeHtml(m.text)}</span>`;
    } else {
      out += `<span class="gp" title="${escapeAttr(m.label)}">${escapeHtml(m.text)}</span>`;
    }
    cursor = m.end;
  }
  out += escapeHtml(s.en.slice(cursor));
  return out;
}

function renderKoTokens(s) {
  const blanked = state.koBlanks.get(s.id) || new Set();
  return s.ko.split(' ').map((tok, i) =>
    `<span class="ko-token${blanked.has(i) ? ' ko-blk' : ''}" data-sid="${s.id}" data-ki="${i}">${escapeHtml(tok)}</span>`
  ).join(' ');
}

// ─── Step 5: Preview ───
function viewPreview() {
  return `
    <div class="edit-head">
      <div>
        <div class="edit-step-tag">Step 4 · Preview</div>
        <h1 class="edit-title">조각 미리보기 <em>전체</em></h1>
      </div>
      <div class="edit-meta">
        <div class="edit-meta-item"><span>pieces</span><b>${state.pieces.length}</b></div>
      </div>
    </div>

    <div class="piece-select-grid">
      <button class="pcard-all ${state.selectedPiece === -1 ? 'on' : ''}" data-select="-1">
        전체 A~${state.pieces.length ? String.fromCharCode(64 + state.pieces.length) : 'D'} 한번에 보기
      </button>
      <div class="pcard-row">
        ${state.pieces.map((p, i) => `
          <button class="pcard ${i === state.selectedPiece ? 'on' : ''}" data-select="${i}">
            <span class="pcard-letter">${p.label}</span>
            <span class="pcard-heading">${escapeHtml((p.heading || '').slice(0, 24))}</span>
            <span class="pcard-meta">${p.sentenceCount}문 · ${p.wordCount}w · ${'★'.repeat(p.stars)}${'☆'.repeat(3-p.stars)}</span>
          </button>
        `).join('')}
      </div>
    </div>

    <div class="step-actions">
      <button class="btn" id="back-blanks">← 빈칸</button>
      <div style="flex:1"></div>
      <button class="btn btn-primary" id="go-export">내보내기 →</button>
    </div>
  `;
}

// ─── Step 5: Export ───
function viewExport() {
  const pieceChecks = state.pieces.map((p, i) => `
    <label style="display:inline-flex;align-items:center;gap:5px;font-family:var(--font-mono);font-size:.76rem;cursor:pointer;margin-right:10px;">
      <input type="checkbox" class="print-piece-check" data-idx="${i}" checked
             style="accent-color:var(--terracotta);width:14px;height:14px;">
      <span style="font-weight:700;">${p.label}</span>
    </label>
  `).join('');

  return `
    <div class="edit-head">
      <div>
        <div class="edit-step-tag">Step 5 · Export</div>
        <h1 class="edit-title">결과 <em>저장</em></h1>
      </div>
    </div>

    <div style="padding:12px 16px;background:var(--paper-warm);border:1px solid var(--paper-edge);border-radius:8px;margin-bottom:18px;">
      <div style="font-family:var(--font-mono);font-size:.66rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3);margin-bottom:8px;">포함할 조각 선택</div>
      <div>${pieceChecks}</div>
    </div>

    <div class="export-grid">
      <button class="export-card" id="x-print-student">
        <div class="x-emoji">🖨️</div>
        <h3>학생용 PDF</h3>
        <p>인쇄 → PDF로 저장</p>
      </button>
      <button class="export-card" id="x-print-teacher">
        <div class="x-emoji">📋</div>
        <h3>교사용 PDF</h3>
        <p>정답 포함 · 인쇄 → PDF</p>
      </button>
      <button class="export-card" id="x-doc-student">
        <div class="x-emoji">📝</div>
        <h3>학생용 DOCX</h3>
        <p>편집 가능한 Word 문서</p>
      </button>
      <button class="export-card" id="x-doc-teacher">
        <div class="x-emoji">📕</div>
        <h3>교사용 DOCX</h3>
        <p>정답 포함 · Word 편집용</p>
      </button>
    </div>

    <div class="step-actions">
      <button class="btn" id="back-preview">← 미리보기</button>
      <div style="flex:1"></div>
    </div>
  `;
}

// ───── Pipeline (자료 → 파이프 끝까지) ─────
function pipeline() {
  if (!state.source.trim()) return;
  state.sentences = parse(state.source);
  state.pieces = autoSplit(state.sentences);
  state.vocab = extract(state.sentences);
  state.vocabByPiece = {};
  const usedVocab = new Set();
  for (let i = 0; i < state.pieces.length; i++) {
    const raw = pickForPiece(state.vocab, state.pieces[i], state.sentences, 10);
    const deduped = raw.filter(c => !usedVocab.has(c.lc)).slice(0, 8);
    deduped.forEach(c => usedVocab.add(c.lc));
    state.vocabByPiece[i] = deduped;
  }
  state.grammarMap = detectAll(state.sentences);
  state.blanks = new Map();
  for (const s of state.sentences) {
    if (s.isHeading || !s.en) continue;
    const sug = suggestBlanks(s.en, { max: 1 });
    if (sug.length) state.blanks.set(s.id, sug);
  }
  state.selectedPiece = 0;
}

// ───── Wiring ─────
document.addEventListener('click', e => {
  const t = e.target;

  // Step navigation via rail
  const stepEl = t.closest('.step');
  if (stepEl) {
    const idx = $$('.step').indexOf(stepEl);
    if (idx >= 0 && (idx === 0 || state.sentences.length)) {
      if (idx === 3) state.selectedPiece = -1;
      e.preventDefault(); go(idx + 1);
    }
    return;
  }

  // Step 1
  if (t.id === 'open-file-btn') { document.getElementById('file-input')?.click(); return; }
  if (t.id === 'load-sample') return loadSample();
  if (t.id === 'go-clean') return submitSource();
  // Step 2
  if (t.id === 'back-upload') return go(1);
  if (t.id === 'go-blanks') return go(3);
  // Step 3
  if (t.id === 'back-split') return go(2);
  if (t.id === 'go-preview') { state.selectedPiece = -1; return go(4); }
  // Step 4
  const ptab = t.closest('.ptab, .pcard, .pcard-all');
  if (ptab) { state.selectedPiece = +ptab.dataset.select; renderEdit(); renderPrev(); return; }
  if (t.id === 'back-blanks') return go(3);
  if (t.id === 'go-export') return go(5);
  // Step 3 — Claude panel
  if (t.id === 'copy-claude-prompt') return copyClaudePrompt();
  if (t.id === 'apply-ai-json') return applyAIJson();
  if (t.id === 'run-ai') return runGrammarExtract();
  if (t.id === 'apply-grammar-btn') return applyGrammarSelections();
  // Step 5
  if (t.id === 'back-preview') { state.selectedPiece = -1; return go(4); }
  if (t.id === 'x-print-student') return printSelected('student');
  if (t.id === 'x-print-teacher') return printSelected('teacher');
  if (t.id === 'x-doc-student') return exportDoc('student');
  if (t.id === 'x-doc-teacher') return exportDoc('teacher');

  // 출제 유형 선택 (Step 3)
  const btypeBtn = t.closest('[data-btype]');
  if (btypeBtn) {
    state.blankType = btypeBtn.dataset.btype;
    renderEdit(); renderPrev(); persist();
    return;
  }

  // 문장 삭제 (Step 2)
  if (t.dataset.delSid !== undefined) {
    const delSid = +t.dataset.delSid;
    if (confirm('이 문장을 삭제할까요?')) {
      state.sentences[delSid].deleted = true;
      for (const p of state.pieces) {
        const bodies = state.sentences.slice(p.range[0], p.range[1]).filter(s => !s.isHeading && !s.deleted);
        p.sentenceCount = bodies.length;
        p.wordCount = bodies.reduce((a, s) => a + s.en.split(/\s+/).length, 0);
      }
      rebuildVocab();
      renderEdit(); renderPrev(); persist();
    }
    return;
  }

  // 별점 변경
  if (t.dataset.setStars) {
    const [idx, n] = t.dataset.setStars.split(':').map(Number);
    state.pieces[idx].stars = n;
    renderEdit(); renderPrev(); persist();
    return;
  }
  // 합치기
  if (t.dataset.merge !== undefined) {
    const idx = +t.dataset.merge;
    state.pieces = removeBoundary(state.pieces, state.sentences, idx);
    rebuildVocab(); state.grammarCandidates = null;
    renderEdit(); renderPrev(); persist();
    return;
  }
  // 나누기
  if (t.dataset.split !== undefined) {
    const atIdx = +t.dataset.split;
    state.pieces = insertBoundary(state.pieces, state.sentences, atIdx);
    rebuildVocab(); state.grammarCandidates = null;
    renderEdit(); renderPrev(); persist();
    return;
  }
  // 빈칸/문법 토글 (Step 4)
  if (t.classList.contains('blk') || t.classList.contains('gp')) {
    const sentEl = t.closest('.sent[data-sid]');
    if (!sentEl) return;
    const sid = +sentEl.dataset.sid;
    if (t.classList.contains('blk')) {
      // 토글: 빈칸 제거
      const blanks = state.blanks.get(sid) || [];
      const text = t.textContent;
      const filtered = blanks.filter(b => b.text !== text);
      if (filtered.length) state.blanks.set(sid, filtered); else state.blanks.delete(sid);
      renderEdit(); renderPrev(); persist();
    }
  }
});

// 더블클릭: 영어 빈칸 추가 / 한국어 토큰 빈칸 토글
document.addEventListener('dblclick', e => {
  if (state.step !== 3) return;

  // 한국어 토큰 더블클릭
  const koTok = e.target.closest('.ko-token');
  if (koTok) {
    e.preventDefault();
    const sid = +koTok.dataset.sid;
    const ki = +koTok.dataset.ki;
    if (!state.koBlanks.has(sid)) state.koBlanks.set(sid, new Set());
    const s = state.koBlanks.get(sid);
    if (s.has(ki)) s.delete(ki); else s.add(ki);
    renderEdit(); renderPrev(); persist();
    return;
  }

  // 영어 단어 선택 더블클릭
  const sent = e.target.closest('.sent[data-sid]');
  if (!sent) return;
  const enEl = sent.querySelector('.sent-en');
  if (!enEl) return;
  const sel = window.getSelection();
  const word = sel.toString().trim();
  if (!word) return;
  const sid = +sent.dataset.sid;
  const s = state.sentences[sid];
  const idx = s.en.indexOf(word);
  if (idx < 0) return;
  const blanks = state.blanks.get(sid) || [];
  if (!blanks.some(b => b.text === word)) {
    blanks.push({ text: word, start: idx, end: idx + word.length });
    blanks.sort((a, b) => a.start - b.start);
    state.blanks.set(sid, blanks);
    renderEdit(); renderPrev(); persist();
  }
});

// 파일 입력 + 문법 후보 체크박스
document.addEventListener('change', e => {
  if (e.target.id === 'file-input') {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.name.toLowerCase().endsWith('.pdf')) {
      loadPDF(file);
    } else {
      const reader = new FileReader();
      reader.onload = ev => {
        state.source = ev.target.result;
        const ta = document.getElementById('source-input');
        if (ta) ta.value = state.source;
        persist();
      };
      reader.readAsText(file, 'utf-8');
    }
    return;
  }
  if (e.target.classList.contains('gc-check')) applyGrammarSelections();
});

// 입력 처리
document.addEventListener('input', e => {
  if (e.target.id === 'source-input') state.source = e.target.value;
  if (e.target.id === 'm-title') state.meta.title = e.target.value;
  if (e.target.id === 'm-lesson') state.meta.lesson = e.target.value;
  if (e.target.id === 'grammar-target') { state.grammarTarget = e.target.value; persist(); return; }
  if (e.target.classList.contains('vocab-edit-meaning')) {
    const pi = +e.target.dataset.piece;
    const vi = +e.target.dataset.vocab;
    if (state.vocabByPiece[pi]?.[vi]) {
      state.vocabByPiece[pi][vi].meaning = e.target.value;
      renderPrev();
    }
  }
  persist();
});

function buildClaudePrompt() {
  const piecesPayload = state.pieces.map((p, idx) => ({
    label: p.label,
    sentences: state.sentences
      .slice(p.range[0], p.range[1])
      .filter(s => !s.isHeading && s.en)
      .map(s => s.en),
    vocab: (state.vocabByPiece[idx] || []).map(v => v.word)
  }));
  return `중학교 영어 직소 학습지 보조 생성입니다.
아래 조각별 영어 본문을 보고 JSON만 출력하세요 (설명 없이).

각 조각에 대해:
1. vocab: 제시된 단어의 한국어 뜻 (중학생 수준, 짧게)
2. question: 본문 내용 기반 영어 comprehension question 1개
3. grammar_match: 해당 조각에서 문법적으로 중요한 어구 (원문 그대로)
4. grammar_explain: 그 어구의 한국어 문법 설명 (1~2문장)

조각 데이터:
${JSON.stringify(piecesPayload, null, 2)}

출력 형식 (JSON만, 다른 텍스트 없이):
{"pieces":[{"label":"A","vocab":{"word":"뜻"},"question":"...?","grammar_match":"...","grammar_explain":"..."}]}`;
}

function copyClaudePrompt() {
  const prompt = buildClaudePrompt();
  navigator.clipboard.writeText(prompt).then(() => {
    const msg = document.getElementById('claude-copy-msg');
    if (msg) { msg.style.display = 'inline'; setTimeout(() => msg.style.display = 'none', 3000); }
  });
}

function applyAIJson() {
  const ta = document.getElementById('ai-json-input');
  if (!ta || !ta.value.trim()) return;
  try {
    const result = JSON.parse(ta.value.trim());
    applyAIResult(result);
    ta.value = '';
    renderEdit(); renderPrev(); persist();
  } catch (e) {
    alert('JSON 파싱 오류: ' + e.message);
  }
}

function renderGrammarCandidates() {
  const cands = state.grammarCandidates;
  if (!cands?.pieces?.length) return '<div class="claude-panel-row" style="color:var(--ink-3);font-size:.82rem;">추출된 문법 포인트가 없습니다.</div>';
  return `
    <div class="gc-list">
      ${cands.pieces.map(pc => `
        <div class="gc-piece">
          <div class="gc-piece-label">조각 ${pc.label}</div>
          ${(pc.candidates || []).map((c, ci) => {
            const key = `${pc.label}-${ci}`;
            const isChecked = state.grammarSelected[key] !== false;
            return `
            <label class="gc-item">
              <input type="checkbox" class="gc-check" data-label="${pc.label}" data-ci="${ci}" ${isChecked ? 'checked' : ''}>
              <span class="gc-match">"${escapeHtml(c.match)}"</span>
              <span class="gc-explain">${escapeHtml(c.explain)}</span>
            </label>`;
          }).join('')}
        </div>
      `).join('')}
    </div>
    <div class="claude-panel-row" style="margin-top:10px;gap:8px;">
      <button class="btn" id="run-ai">↺ 다시 추출</button>
    </div>`;
}

async function runAIEnrich(applySplit = false) {
  state.aiLoading = true;
  renderEdit();
  try {
    const result = await enrichWithAI(state);
    applyAIResult(result, applySplit);
    renderEdit(); renderPrev(); persist();
    // Phase 1.5 + Phase 2 병렬 실행
    runTranslate();
    runGrammarExtract();
  } catch (e) {
    showAIError(e.message);
  } finally {
    state.aiLoading = false;
    renderEdit();
  }
}

function suggestKoBlanks(ko) {
  if (!ko) return new Set();
  const tokens = ko.split(' ');
  const SKIP = new Set(['때문에','하지만','그리고','그래서','하면','하여','이지만','이고','이며','으로','이다','했다','있다','없다','한다','된다','이다.','했다.','있다.','없다.','한다.']);
  const max = tokens.length <= 5 ? 1 : 2;
  const candidates = tokens
    .map((tok, i) => ({ tok: tok.replace(/[.,!?]$/, ''), i, len: tok.length }))
    .filter(({ tok }) => tok.length >= 3 && !SKIP.has(tok) && /[가-힣]/.test(tok))
    .sort((a, b) => b.len - a.len);
  const blanks = new Set();
  for (const { i } of candidates) {
    if (blanks.size >= max) break;
    blanks.add(i);
  }
  return blanks;
}

async function runTranslate() {
  try {
    const result = await translateSentences(state);
    if (result && typeof result === 'object') {
      for (const [idx, val] of Object.entries(result)) {
        const s = state.sentences[Number(idx)];
        if (!s || s.ko) continue;
        s.ko = typeof val === 'string' ? val : (val?.ko || '');
        if (s.ko && !state.koBlanks.has(s.id)) {
          const suggested = suggestKoBlanks(s.ko);
          if (suggested.size) state.koBlanks.set(s.id, suggested);
        }
      }
      renderPrev(); persist();
    }
  } catch (e) { /* 번역 실패는 조용히 무시 */ }
}

async function runGrammarExtract() {
  state.grammarLoading = true;
  state.grammarCandidates = null;
  renderEdit();
  try {
    const result = await extractGrammarCandidates(state);
    state.grammarCandidates = result;
    // 초기에 모두 선택 상태로 초기화
    state.grammarSelected = {};
    (result.pieces || []).forEach(pc =>
      (pc.candidates || []).forEach((_, ci) => {
        state.grammarSelected[`${pc.label}-${ci}`] = true;
      })
    );
    renderEdit();
    applyGrammarSelections();
    renderPrev(); persist();
  } catch (e) {
    showAIError(e.message);
  } finally {
    state.grammarLoading = false;
    renderEdit();
  }
}

function applyGrammarSelections() {
  if (!state.grammarCandidates) return;

  // DOM에서 체크 상태 먼저 저장 (renderEdit 이전에 캡처)
  document.querySelectorAll('.gc-check').forEach(cb => {
    state.grammarSelected[`${cb.dataset.label}-${cb.dataset.ci}`] = cb.checked;
  });

  // 기존 AI 문법 히트 초기화
  for (const [sid, hits] of state.grammarMap) {
    const filtered = hits.filter(h => h.label !== 'AI');
    if (filtered.length) state.grammarMap.set(sid, filtered);
    else state.grammarMap.delete(sid);
  }

  const checks = [...document.querySelectorAll('.gc-check:checked')];
  for (const cb of checks) {
    const pcLabel = cb.dataset.label;
    const ci = +cb.dataset.ci;
    const pc = state.grammarCandidates.pieces?.find(p => p.label === pcLabel);
    if (!pc) continue;
    const cand = pc.candidates?.[ci];
    if (!cand?.match) continue;

    const pieceIdx = state.pieces.findIndex(p => p.label === pcLabel);
    if (pieceIdx < 0) continue;
    const piece = state.pieces[pieceIdx];
    for (const s of state.sentences.slice(piece.range[0], piece.range[1])) {
      if (s.isHeading || !s.en.includes(cand.match)) continue;
      const existing = state.grammarMap.get(s.id) || [];
      state.grammarMap.set(s.id, [
        { match: cand.match, label: 'AI', explain: cand.explain },
        ...existing.filter(h => h.match !== cand.match)
      ]);
      break;
    }
  }

  renderEdit(); renderPrev(); persist();
}

function applyAISplit(splitAt) {
  const n = state.sentences.length;
  state.pieces = splitAt.map((start, i) => {
    const end = splitAt[i + 1] !== undefined ? splitAt[i + 1] : n;
    const rangeSentences = state.sentences.slice(start, end);
    const heading = rangeSentences.find(s => s.isHeading)?.en || '';
    const bodies = rangeSentences.filter(s => !s.isHeading && s.en);
    return {
      label: String.fromCharCode(65 + i),
      range: [start, end],
      heading,
      sentenceCount: bodies.length,
      wordCount: bodies.reduce((a, s) => a + s.en.split(/\s+/).length, 0),
      stars: 2
    };
  });
  rebuildVocab();
}

function applyAIResult(result, applySplit = false) {
  if (applySplit && Array.isArray(result.split_at) && result.split_at.length >= 2) {
    applyAISplit(result.split_at);
  }

  // 단어 뜻 lookup 구성: 최상위 vocab_meanings + piece별 vocab(수동 복붙 경로) 모두 수집
  // 키 정규화(소문자·기호제거·단수형)로 DeepSeek가 키를 변형해도 매칭되게 함
  const normKey = w => String(w ?? '').toLowerCase().replace(/[^a-z]/g, '');
  const singular = n => n.length >= 4 ? n.replace(/ies$/, 'y').replace(/(es|s)$/, '') : n;
  const meaningLookup = new Map();
  const addMeaning = (k, val) => {
    if (typeof val !== 'string' || !val.trim()) return;
    const n = normKey(k);
    if (!n) return;
    if (!meaningLookup.has(n)) meaningLookup.set(n, val.trim());
    const s = singular(n);
    if (s && !meaningLookup.has(s)) meaningLookup.set(s, val.trim());
  };
  if (result.vocab_meanings && typeof result.vocab_meanings === 'object') {
    for (const [k, val] of Object.entries(result.vocab_meanings)) addMeaning(k, val);
  }
  for (const pd of (result.pieces || [])) {
    if (pd.vocab && typeof pd.vocab === 'object') {
      for (const [k, val] of Object.entries(pd.vocab)) addMeaning(k, val);
    }
  }
  for (const vocabList of Object.values(state.vocabByPiece)) {
    for (const v of vocabList) {
      const n = normKey(v.word);
      const meaning = meaningLookup.get(n) || meaningLookup.get(singular(n));
      if (meaning) v.meaning = meaning;
    }
  }

  // 문장 번역: sentence_ko = { "인덱스": "한국어번역" }
  if (result.sentence_ko && typeof result.sentence_ko === 'object') {
    for (const [idx, ko] of Object.entries(result.sentence_ko)) {
      const s = state.sentences[Number(idx)];
      if (s && !s.ko && typeof ko === 'string') s.ko = ko;
    }
  }

  for (const pd of (result.pieces || [])) {
    const idx = state.pieces.findIndex(p => p.label === pd.label);
    if (idx < 0) continue;

    // 질문 + 모범 답안
    if (pd.question) state.pieces[idx].aiQuestion = pd.question;
    if (pd.answer) state.pieces[idx].aiAnswer = pd.answer;

    // 문법
    if (pd.grammar_match && pd.grammar_explain) {
      const piece = state.pieces[idx];
      const rangeSentences = state.sentences.slice(piece.range[0], piece.range[1]);
      for (const s of rangeSentences) {
        if (s.isHeading) continue;
        if (s.en.includes(pd.grammar_match)) {
          const existing = state.grammarMap.get(s.id) || [];
          const aiHit = { match: pd.grammar_match, label: 'AI', explain: pd.grammar_explain };
          state.grammarMap.set(s.id, [aiHit, ...existing.filter(h => h.label !== 'AI')]);
          break;
        }
      }
    }
  }
}

function showAIError(msg) {
  const edit = $('.edit');
  const banner = document.createElement('div');
  banner.style.cssText = 'padding:10px 16px;background:var(--terracotta-soft);border:1px solid var(--terracotta);border-radius:6px;font-family:var(--font-mono);font-size:.76rem;color:var(--terracotta);margin-bottom:12px;';
  banner.textContent = `AI 보완 실패: ${msg}`;
  edit.prepend(banner);
  setTimeout(() => banner.remove(), 5000);
}

function rebuildVocab() {
  state.vocabByPiece = {};
  const usedVocab = new Set();
  for (let i = 0; i < state.pieces.length; i++) {
    const raw = pickForPiece(state.vocab, state.pieces[i], state.sentences, 10);
    const deduped = raw.filter(c => !usedVocab.has(c.lc)).slice(0, 8);
    deduped.forEach(c => usedVocab.add(c.lc));
    state.vocabByPiece[i] = deduped;
  }
}

async function submitSource() {
  if (!state.source.trim()) {
    alert('본문을 먼저 붙여넣어 주세요. "샘플 불러오기"로 동아윤 L4 본문을 써볼 수도 있어요.');
    return;
  }
  pipeline();
  go(2);

  runAIEnrich(true); // AI가 split_at도 함께 결정
}

async function loadSample() {
  try {
    const r = await fetch(SAMPLE_URL);
    const text = await r.text();
    state.source = text;
    state.meta = { title: 'Why Trees Are Smarter Than You Think', lesson: 'Lesson 4' };
    $('#source-input').value = text;
    $('#m-title').value = state.meta.title;
    $('#m-lesson').value = state.meta.lesson;
    persist();
  } catch (e) {
    console.error(e);
    alert('샘플 로드 실패. 콘솔 확인.');
  }
}

// ───── PDF 입력 ─────
async function loadPDF(file) {
  const statusMsg = '📄 PDF 불러오는 중...';
  const ta = document.getElementById('source-input');
  if (ta) ta.placeholder = statusMsg;
  try {
    if (!window.pdfjsLib) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
          window.pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
          resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
      });
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const lines = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ').trim();
      if (pageText) lines.push(pageText);
    }
    state.source = lines.join('\n\n');
    if (ta) { ta.value = state.source; ta.placeholder = ''; }
    persist();
  } catch (err) {
    alert('PDF 로드 실패: ' + err.message);
    if (ta) ta.placeholder = '본문을 여기에 붙여넣으세요.';
  }
}

// ───── Export ─────
function getSelectedPieceIdxs() {
  const checks = [...document.querySelectorAll('.print-piece-check')];
  if (!checks.length) return state.pieces.map((_, i) => i); // 체크박스 없으면 전체
  return checks.filter(c => c.checked).map(c => +c.dataset.idx);
}

function exportHTML(mode) {
  const idxs = getSelectedPieceIdxs();
  const html = buildStandaloneHTML(mode, idxs);
  const name = `${safeName()}-${mode === 'student' ? 'Ss' : 'T'}.html`;
  const blob = new Blob([html], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 2000);
}

function printSelected(mode = 'student') {
  const idxs = getSelectedPieceIdxs();
  const pages = idxs.map(i => renderPaper(state, i, mode)).join('\n<div class="page-break"></div>\n');
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>인쇄</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,800;1,9..144,500;1,9..144,700&family=JetBrains+Mono:wght@600&family=Noto+Serif+KR:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>${EXPORT_CSS}
body{padding:16px;}@media print{body{padding:0;}}</style>
</head><body>${pages}</body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    alert('팝업이 차단되었습니다. 주소창 오른쪽에서 팝업 허용 후 다시 시도하세요.');
    URL.revokeObjectURL(url);
    return;
  }
  win.addEventListener('load', () => {
    win.print();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  });
}

function exportDoc(mode) {
  try {
    const idxs = getSelectedPieceIdxs();
    if (!idxs.length) { alert('조각을 하나 이상 선택하세요.'); return; }
    const pages = idxs.map(i => renderPaper(state, i, mode))
      .join('<div style="page-break-after:always;"></div>');
    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><style>${EXPORT_CSS}</style></head>
<body>${pages}</body></html>`;
    const blob = new Blob([html], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName()}-${mode === 'student' ? 'Ss' : 'T'}.doc`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 2000);
  } catch (e) {
    alert('DOCX 생성 오류: ' + e.message);
  }
}

function exportMD() {
  const md = buildMarkdown();
  download(`${safeName()}.md`, md, 'text/markdown');
}

function safeName() {
  return ((state.meta.title || 'jigsaw') + (state.meta.lesson ? '-' + state.meta.lesson : ''))
    .replace(/[^a-zA-Z0-9가-힯-]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'jigsaw';
}

function download(name, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 2000);
}

function buildStandaloneHTML(mode, idxs) {
  const indices = idxs ?? state.pieces.map((_, i) => i);
  const pages = indices.map(i => renderPaper(state, i, mode)).join('\n<div class="page-break"></div>\n');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>${escapeHtml(state.meta.title || '직소 학습지')} · ${mode === 'student' ? '학생용' : '교사용'}</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,800;1,9..144,500;1,9..144,700&family=JetBrains+Mono:wght@600&family=Noto+Serif+KR:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<style>
${EXPORT_CSS}
</style></head><body>
${pages}
</body></html>`;
}

function buildMarkdown() {
  const lines = [];
  lines.push(`# ${state.meta.title || '직소 학습지'}`);
  lines.push(`> ${state.meta.lesson || ''}\n`);
  for (const p of state.pieces) {
    lines.push(`\n## ${p.label}. ${p.heading || '(소제목 없음)'} ${'★'.repeat(p.stars)}${'☆'.repeat(3-p.stars)}`);
    const rangeSentences = state.sentences.slice(p.range[0], p.range[1]).filter(s => !s.isHeading);
    lines.push('\n### Vocabulary');
    for (const v of (state.vocabByPiece[p.id] || [])) {
      lines.push(`- ${v.word} : ${v.meaning || '_____________'}`);
    }
    lines.push('\n### Slow Reading');
    for (const s of rangeSentences) {
      lines.push(`- ${s.en}${s.ko ? '\n  → ' + s.ko : ''}`);
    }
  }
  return lines.join('\n');
}

// 내보내기용 인쇄 CSS (학습지 본체)
const EXPORT_CSS = `
:root{--paper:#fbf6ec;--paper-warm:#f6efde;--paper-edge:#e8dcc1;--ink:#181613;--ink-3:#5d544a;--ink-mute:#cbc1ad;--pen:#1d2d8c;--terracotta:#a8431c;--moss:#3f6048;}
body{margin:0;background:var(--paper);font-family:'Noto Serif KR','Fraunces',serif;color:var(--ink);padding:24px;}
.paper{max-width:760px;margin:0 auto 32px;background:var(--paper-warm);border:1px solid var(--paper-edge);padding:32px 30px;box-shadow:0 18px 40px -12px rgba(40,32,20,.18);}
.paper-id-row{display:flex;gap:28px;justify-content:flex-end;font-family:'JetBrains Mono',monospace;font-size:.7rem;color:#5d544a;margin-bottom:12px;letter-spacing:.03em;}
.paper-id-row .id-line{display:inline-block;width:96px;border-bottom:1px solid #5d544a;vertical-align:bottom;margin-left:5px;}
.paper-head{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:14px;margin-bottom:18px;border-bottom:2px solid var(--ink);}
.paper-letter{font-family:'Fraunces';font-style:italic;font-weight:900;font-size:3.2rem;line-height:.85;letter-spacing:-.05em;}
.paper-title{text-align:right;font-family:'Fraunces';font-style:italic;font-weight:600;font-size:1rem;color:var(--ink-3);}
.paper-title b{display:block;font-family:'Fraunces';font-weight:800;font-style:normal;font-size:1.16rem;color:var(--ink);}
.paper-title .meta{font-family:'JetBrains Mono';font-size:.66rem;font-weight:600;color:var(--ink-3);letter-spacing:.14em;text-transform:uppercase;margin-top:6px;font-style:normal;}
.paper-sidebar{background:rgba(255,255,255,.55);border:1px dashed var(--ink-mute);border-radius:4px;padding:10px 12px;font-family:'JetBrains Mono';font-size:.7rem;color:var(--ink-3);margin-bottom:18px;}
.paper-sidebar h4{font-family:'Fraunces';font-style:italic;font-size:.86rem;color:var(--ink);margin-bottom:5px;}
.paper-sidebar ul{list-style:none;padding:0;margin:0;}
.paper-sidebar li{display:flex;gap:6px;}
.paper-sidebar li::before{content:'□';color:var(--ink);}
.paper-step{margin-bottom:22px;}
.paper-step-label{display:flex;align-items:baseline;gap:10px;margin-bottom:10px;}
.paper-step-num{font-family:'Fraunces';font-style:italic;font-weight:700;font-size:1.4rem;color:var(--terracotta);}
.paper-step-name{font-family:'Fraunces';font-weight:700;font-size:1.04rem;color:var(--ink);}
.paper-step-aside{margin-left:auto;font-family:'JetBrains Mono';font-size:.62rem;color:var(--ink-3);letter-spacing:.1em;text-transform:uppercase;}
.vocab-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px;list-style:none;padding:0;margin:0;font-size:.86rem;}
.vocab-grid li{display:flex;gap:8px;border-bottom:1px dotted var(--ink-mute);padding-bottom:1px;}
.vocab-grid .w{font-weight:600;min-width:90px;}
.vocab-grid .m{color:var(--ink-3);font-style:italic;}
.vocab-grid .m.fill{color:var(--ink-mute);}
.slow{border-top:1px solid var(--ink-mute);padding-top:10px;}
.slow-row{padding:8px 0;border-bottom:1px dotted var(--ink-mute);}
.slow-en{font-family:'Fraunces','Noto Serif KR',serif;font-size:.98rem;line-height:1.65;font-weight:500;}
.slow-en .b{border-bottom:1px solid var(--ink);padding:0 12px;color:transparent;min-width:80px;display:inline-block;}
.slow-en .b.fill{color:var(--terracotta);font-weight:600;}
.slow-en u{text-decoration:underline;text-decoration-thickness:2px;text-decoration-color:var(--pen);text-underline-offset:3px;}
.slow-ko{font-size:.84rem;color:var(--ink-3);font-style:italic;margin-top:4px;}
.slow-ko-cloze{color:var(--ink-2);font-style:normal;font-weight:500;}
.ko-gap{display:inline-block;min-width:80px;border-bottom:1.5px solid #5d544a;vertical-align:baseline;}
.slow-note{margin-top:6px;font-family:'JetBrains Mono';font-size:.66rem;color:#0f1d6b;padding-left:14px;border-left:2px solid var(--pen);}
.q-card{background:rgba(255,255,255,.45);border:1px solid var(--ink-mute);border-radius:4px;padding:12px 14px;font-size:.88rem;}
.q-card .qm{font-weight:700;margin-right:6px;}
.q-card .answer-line{display:block;margin-top:6px;border-bottom:1px solid var(--ink-mute);height:1.4em;}
.grammar-card{background:rgba(29,45,140,.03);border:1px solid rgba(29,45,140,.2);border-radius:4px;padding:12px 14px;margin-bottom:8px;}
.grammar-card .sentence{font-family:'Fraunces';font-size:.96rem;font-weight:600;margin:8px 0 10px;padding:10px 14px;background:rgba(255,255,255,.7);border:1px solid #cbc1ad;border-radius:3px;text-align:center;}
.grammar-card .ask{font-size:.8rem;color:#3d3830;font-style:normal;font-weight:500;}.grammar-card .ask.answer{color:#c0392b;font-weight:600;}
.grammar-card .answer-ko{font-size:.8rem;color:#3d3830;font-weight:500;margin-bottom:4px;padding-bottom:4px;border-bottom:1px dotted #cbc1ad;}
.grammar-card .answer-line{display:block;margin-top:5px;border-bottom:1px solid var(--ink-mute);height:1.4em;}
.grammar-hl{border-bottom:2px solid #a8431c;color:#a8431c;font-weight:700;background:rgba(168,67,28,.07);text-decoration:none;}
.page-break{page-break-after:always;}
@media print{ body{background:#fff;padding:0;} .paper{box-shadow:none;border:none;page-break-after:always;} }
`;

// ───── Persist ─────
function persist() {
  try {
    const snap = {
      step: state.step,
      mode: state.mode,
      meta: state.meta,
      source: state.source,
      sentences: state.sentences,
      pieces: state.pieces,
      vocab: state.vocab,
      vocabByPiece: state.vocabByPiece,
      grammarMap: [...state.grammarMap.entries()],
      blanks: [...state.blanks.entries()],
      koBlanks: [...state.koBlanks.entries()].map(([sid, set]) => [sid, [...set]]),
      selectedPiece: state.selectedPiece,
      grammarTarget: state.grammarTarget,
      blankType: state.blankType,
      showKo: state.showKo
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  } catch (e) { /* quota / private mode → skip */ }
}

function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    Object.assign(state, s);
    state.grammarMap = new Map(s.grammarMap || []);
    state.blanks = new Map(s.blanks || []);
    state.koBlanks = new Map((s.koBlanks || []).map(([sid, arr]) => [sid, new Set(arr)]));
    // 구버전 필드 정리
    if (state.meta) { delete state.meta.textbook; }
    // studentMode → blankType/showKo 마이그레이션
    if (!state.blankType) {
      const old = state.studentMode;
      state.blankType = (old === 'en-blank') ? 'en' : 'ko';
      state.showKo = (old !== 'off');
    }
    if (state.showKo === undefined) state.showKo = true;
    delete state.studentMode;
    delete state.showKoStudent;
    // 구버전 vocab sids(Set→{} or undefined) 감지 시 재추출
    if (state.sentences?.length && state.vocab?.some(c => !Array.isArray(c.sids))) {
      state.vocab = extract(state.sentences);
      rebuildVocab();
    }
    return true;
  } catch (e) {
    return false;
  }
}

// ───── Utils ─────
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

// ───── Init ─────
function init() {
  if (restore() && state.sentences.length) {
    go(state.step);
  } else {
    go(1);
  }
}

window.addEventListener('DOMContentLoaded', init);
window.__JIG__ = { state }; // 디버그
