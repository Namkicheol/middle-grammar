// engine/blanks.js — 빈칸 자동 추천 + 토글

const BLANK_BIAS = [
  /\b(in|on|at|to|from|by|with|for|of|about|into|onto|over|under|through)\b/gi,
  /\b(hold on|fall for|fall in|look for|look at|look up|look like|hold up|hold off|set up|set down|give up|give in|run into|run out|put on|put off|take on|take off|wake up|wake)\b/gi,
  /\b(is|are|was|were|am)\b/gi,
  /\b(who|which|that|whose|whom)\b/gi,
  /\b\w+(ed|ing)\b/gi
];

// 한 문장에서 빈칸 후보 추출
// strategy: bias 패턴 중 1~2개 매칭. 너무 흔하면 (a/the/is) 1개만.
export function suggest(sentenceText, opts = {}) {
  const max = opts.max ?? 2;
  if (!sentenceText) return [];
  const candidates = [];

  for (const re of BLANK_BIAS) {
    const matches = [...sentenceText.matchAll(re)];
    for (const m of matches) {
      candidates.push({
        text: m[0],
        start: m.index,
        end: m.index + m[0].length,
        priority: pri(m[0], re)
      });
    }
  }

  // 중복 제거 (같은 위치 한 번만)
  const sorted = candidates.sort((a, b) => b.priority - a.priority || a.start - b.start);
  const used = [];
  const result = [];
  for (const c of sorted) {
    if (result.length >= max) break;
    if (used.some(r => overlap(r, c))) continue;
    result.push(c);
    used.push(c);
  }
  return result.sort((a, b) => a.start - b.start);
}

function overlap(a, b) {
  return !(a.end <= b.start || b.end <= a.start);
}

function pri(word, re) {
  // 구동사 > 관계대명사 > be동사 > 전치사 > -ed/-ing
  const lc = word.toLowerCase();
  if (/\s/.test(lc)) return 100; // 구동사
  if (/^(who|which|that)$/.test(lc)) return 80;
  if (/^(is|are|was|were|am)$/.test(lc)) return 30; // be는 흔해서 낮춤
  if (/^(in|on|at|to|by|with|for|of)$/.test(lc)) return 40;
  if (/(ed|ing)$/.test(lc) && lc.length > 4) return 60;
  return 20;
}

// 한 문장에 적용 + en에 마크업 삽입 (학생용 표시)
export function applyBlanks(text, blanks) {
  // blanks는 sorted by start
  let out = '';
  let cursor = 0;
  for (const b of blanks) {
    out += text.slice(cursor, b.start);
    out += `<span class="b" data-answer="${escapeAttr(b.text)}">&nbsp;&nbsp;&nbsp;</span>`;
    cursor = b.end;
  }
  out += text.slice(cursor);
  return out;
}

// 교사용 (정답 노출)
export function applyBlanksTeacher(text, blanks) {
  let out = '';
  let cursor = 0;
  for (const b of blanks) {
    out += text.slice(cursor, b.start);
    out += `<span class="b fill">${escapeHtml(b.text)}</span>`;
    cursor = b.end;
  }
  out += text.slice(cursor);
  return out;
}

function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
