const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function stripHtml(s) {
  return s.replace(/<span\s+class=["']ex["'][^>]*>[\s\S]*?<\/span>/g, '') // 워크시트 힌트 괄호 제거
          .replace(/<em>___<\/em>/g, '___')
          .replace(/<input\b[^>]*>/g, '___')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
}

function norm(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function attr(tag, name) {
  const re = new RegExp(name + "\\s*=\\s*([\"'])(.*?)\\1");
  const match = tag.match(re);
  return match ? match[2].trim() : '';
}

function unique(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = norm(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitInlineKor(text, fallbackKor) {
  const clean = String(text || '').trim();
  if (!clean.startsWith('🇰🇷')) return { eng: clean, kor: fallbackKor || '' };
  const withoutFlag = clean.replace(/^🇰🇷\s*/, '');
  const match = withoutFlag.match(/^(.+?[.!?])\s+([A-Z][\s\S]*)$/);
  if (!match) return { eng: withoutFlag, kor: fallbackKor || '' };
  return { eng: match[2].trim(), kor: fallbackKor || match[1].trim() };
}

// Pattern A: HTML inline (data-ans in .choices div)
function parsePatternA(html, unitKey) {
  const questions = [];
  const blocks = html.split(/<div\s+class=["']question-card["']/);
  blocks.shift(); // remove prefix

  let idx = 0;
  for (const block of blocks) {
    const idMatch = block.match(/id=["']qc-([^"']+)["']/);
    let qid = idMatch ? idMatch[1] : `q${++idx}`;
    let ans = '';

    const opts = [];
    const choiceSection = block.match(/<div\b[^>]*class=["']choices["'][^>]*>([\s\S]*?)<\/div>/);
    if (choiceSection) {
      const choiceTag = choiceSection[0].match(/<div\b[^>]*>/);
      if (choiceTag) {
        qid = attr(choiceTag[0], 'data-qid') || qid;
        ans = attr(choiceTag[0], 'data-ans');
      }
      let m;
      const choiceRe = /<button\b[^>]*class=["']choice["'][^>]*>([\s\S]*?)<\/button>/g;
      while ((m = choiceRe.exec(choiceSection[1])) !== null) {
        opts.push(stripHtml(m[1]));
      }
    }

    // Skip fix(오류수정), scramble(배열), and input(주관식) — not suitable for MCQ game
    if (/q-type\s+fix|q-type\s+arr/.test(block)) continue;
    if (opts.length === 0) continue;
    if (!ans) continue;

    // Extract q-text
    const qtextMatch = block.match(/<div\b[^>]*class=["']q-text["'][^>]*>([\s\S]*?)<\/div>/);
    let eng = qtextMatch ? stripHtml(qtextMatch[1]) : '';

    // Extract q-kor
    const korMatch = block.match(/<div\b[^>]*class=["']q-kor["'][^>]*>([\s\S]*?)<\/div>/);
    const hintMatch = block.match(/📝\s*해석:\s*([\s\S]*?)<\/div>/);
    let kor = korMatch ? stripHtml(korMatch[1]) : hintMatch ? stripHtml(hintMatch[1]) : '';
    ({ eng, kor } = splitInlineKor(eng, kor));

    const cleanOpts = unique(opts);
    if (cleanOpts.length > 0 && !cleanOpts.some(opt => norm(opt) === norm(ans))) cleanOpts.unshift(ans);

    questions.push({
      id: `${unitKey}_${qid}`,
      kor,
      eng,
      ans,
      opts: cleanOpts
    });
  }
  return questions;
}

// Pattern B: gerund-basic (qData JS object)
function parsePatternB(html, unitKey) {
  const questions = [];
  const match = html.match(/const qData\s*=\s*(\{[\s\S]*?\});\s*\n\s*let/);
  if (!match) return questions;

  let rawObj = match[1];
  // Evaluate safely - extract sec0 and sec1 arrays
  const sec0Match = rawObj.match(/sec0:\s*(\[[\s\S]*?\]),\s*\/\/ Part 2/);
  const sec1Match = rawObj.match(/sec1:\s*(\[[\s\S]*?\]),\s*\/\/ Part 3/);

  function parseSection(arrStr, prefix) {
    if (!arrStr) return [];
    const items = [];
    // Use Function to evaluate the array safely
    try {
      const arr = Function('"use strict"; return (' + arrStr + ')')();
      let idx = 0;
      for (const q of arr) {
        if (q.type !== 'mcq') continue;
        const eng = stripHtml(q.eng);
        idx++;
        items.push({
          id: `${unitKey}_${prefix}${idx}`,
          kor: q.kor || '',
          eng,
          ans: q.ans,
          opts: q.opts
        });
      }
    } catch(e) {
      console.error('Pattern B parse error:', e.message);
    }
    return items;
  }

  const s0 = parseSection(sec0Match && sec0Match[1], 's0q');
  const s1 = parseSection(sec1Match && sec1Match[1], 's1q');
  return [...s0, ...s1];
}

function fillOptions(questions) {
  const answerBank = unique(questions.map(q => q.ans));
  return questions.map((q, index) => {
    const opts = unique([q.ans, ...(q.opts || [])]);
    const sorted = answerBank
      .filter(ans => norm(ans) !== norm(q.ans))
      .sort((a, b) => Math.abs(a.length - q.ans.length) - Math.abs(b.length - q.ans.length));
    for (const ans of sorted) {
      if (opts.length >= 4) break;
      opts.push(ans);
    }
    const four = opts.slice(0, 4);
    const shift = index % four.length;
    return { ...q, opts: [...four.slice(shift), ...four.slice(0, shift)] };
  });
}

const UNITS = [
  { key: 'g1-l1', label: '중1 L1 · be동사 & 일반동사', color: '#0ea5e9', files: [{ file: 'be-verb/v2.html', pattern: 'A' }, { file: 'general-verb-hard/index.html', pattern: 'A' }] },
  { key: 'g1-l2', label: '중1 L2 · 현재진행형 & 동명사', color: '#6366f1', files: [{ file: 'gerund-basic/index.html', pattern: 'B' }, { file: 'gerund-basic/index2.html', pattern: 'B' }, { file: 'gerund-hard/index.html', pattern: 'B' }] },
  { key: 'g1-l3', label: '중1 L3 · be동사 과거형', color: '#22c55e', files: [{ file: 'past-be/index.html', pattern: 'A' }, { file: 'past-be-hard/index.html', pattern: 'A' }] },
  { key: 'g1-l4', label: '중1 L4 · to부정사 & will/should', color: '#f59e0b', files: [{ file: 'to-will-basic/index.html', pattern: 'A' }, { file: 'to-will-hard/index.html', pattern: 'A' }] },
  { key: 'g1-l5', label: '중1 L5 · 재귀대명사 & to부정사', color: '#8b5cf6', files: [{ file: 'reflexive-to-basic/index.html', pattern: 'A' }, { file: 'reflexive-to-hard/index.html', pattern: 'A' }] },
  { key: 'g1-l6', label: '중1 L6 · 감각동사 & because', color: '#ef4444', files: [{ file: 'look-because-basic/index.html', pattern: 'A' }, { file: 'look-because-hard/index.html', pattern: 'A' }] },
  { key: 'g2-l1', label: '중2 L1 · 수여동사 & 관계대명사', color: '#0d9488', files: [{ file: 'g2-give-relclause-basic/index.html', pattern: 'A' }, { file: 'g2-give-relclause-hard/index.html', pattern: 'A' }] },
  { key: 'g2-l2', label: '중2 L2 · 현재완료 & 비교급', color: '#f97316', files: [{ file: 'g2-perfect-compare-basic/index.html', pattern: 'A' }, { file: 'g2-perfect-compare-hard/index.html', pattern: 'A' }] },
  { key: 'g2-l3', label: '중2 L3 · 형용사 to부정사 & if', color: '#ec4899', files: [{ file: 'g2-to-if-basic/index.html', pattern: 'A' }, { file: 'g2-to-if-hard/index.html', pattern: 'A' }] },
  { key: 'g2-l4', label: '중2 L4 · so~that & 수동태', color: '#84cc16', files: [{ file: 'g2-sothat-passive-basic/index.html', pattern: 'A' }, { file: 'g2-sothat-passive-hard/index.html', pattern: 'A' }, { file: 'g2-passive-practice/index.html', pattern: 'A' }] },
];

const result = {};
let totalOk = 0;
let errors = [];

for (const unit of UNITS) {
  let questions = [];
  for (const source of unit.files) {
    const filePath = path.join(ROOT, source.file);
    if (!fs.existsSync(filePath)) {
      console.error(`[MISSING] ${source.file}`);
      errors.push(unit.key);
      continue;
    }
    const html = fs.readFileSync(filePath, 'utf8');
    const prefix = unit.key.replace(/-/g, '_') + '_' + path.dirname(source.file).replace(/\W+/g, '_');
    const level = /hard|심화|practice/.test(source.file) ? 2 : 1;
    const parsed = source.pattern === 'A' ? parsePatternA(html, prefix) : parsePatternB(html, prefix);
    parsed.forEach(q => { q.level = level; });
    questions.push(...parsed);
  }

  // 기초(level 1) → 심화(level 2) 순 정렬
  questions.sort((a, b) => (a.level || 1) - (b.level || 1));
  questions = fillOptions(questions);

  // Validate
  const valid = questions.filter(q => q.opts.some(opt => norm(opt) === norm(q.ans)) && q.eng && q.opts.length === 4);
  const dropped = questions.length - valid.length;
  if (dropped > 0) console.warn(`[WARN] ${unit.key}: dropped ${dropped} invalid questions`);

  console.log(`[OK] ${unit.key}: ${valid.length} MCQ questions`);
  if (valid.length < 10) {
    console.warn(`[WARN] ${unit.key}: only ${valid.length} questions (target ≥ 15)`);
  }

  result[unit.key] = {
    label: unit.label,
    color: unit.color,
    questions: valid
  };
  totalOk += valid.length;
}

// all = empty, merged at runtime
result['all'] = { label: '전체 랜덤', color: '#64748b', questions: [] };

console.log(`\nTotal: ${totalOk} questions across ${UNITS.length} units`);
if (errors.length) console.error('Errors:', errors);

const output = `// Auto-generated by tools/extract-questions.js — do not edit manually
// Generated: ${new Date().toISOString().slice(0,10)}
const GAME_QUESTIONS = ${JSON.stringify(result, null, 2)};
`;

const outPath = path.join(ROOT, 'game', 'questions.js');
fs.writeFileSync(outPath, output, 'utf8');
console.log(`\nWritten: ${outPath}`);
