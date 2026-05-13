const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function stripHtml(s) {
  return s.replace(/<em>___<\/em>/g, '___')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
}

// Pattern A: HTML inline (data-ans in .choices div)
function parsePatternA(html, unitKey) {
  const questions = [];
  const cardRe = /<div class='question-card'[^>]*id='qc-([^']+)'[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
  // More robust: find each question-card block
  const blocks = html.split(/<div class='question-card'/);
  blocks.shift(); // remove prefix

  let idx = 0;
  for (const block of blocks) {
    // Check if MCQ (has .choices with data-ans)
    const choicesMatch = block.match(/class='choices'\s+data-qid='([^']+)'\s+data-ans='([^']+)'/);
    if (!choicesMatch) continue; // skip non-MCQ

    const qid = choicesMatch[1];
    const ans = choicesMatch[2];

    // Extract choices
    const opts = [];
    const choiceRe = /<button class="choice"[^>]*>([^<]+)<\/button>/g;
    let m;
    const choiceSection = block.match(/class='choices'[^>]+>([\s\S]*?)<\/div>/);
    if (choiceSection) {
      while ((m = choiceRe.exec(choiceSection[1])) !== null) {
        opts.push(m[1].trim());
      }
    }
    if (opts.length < 2) continue;

    // Extract q-text
    const qtextMatch = block.match(/<div class='q-text'>([\s\S]*?)<\/div>/);
    const eng = qtextMatch ? stripHtml(qtextMatch[1]) : '';

    // Extract q-kor
    const korMatch = block.match(/<div class='q-kor'>([\s\S]*?)<\/div>/);
    const kor = korMatch ? stripHtml(korMatch[1]) : '';

    // Skip if ans not in opts
    if (!opts.includes(ans)) continue;

    idx++;
    questions.push({
      id: `${unitKey}_${qid}`,
      kor,
      eng,
      ans,
      opts
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

const UNITS = [
  { key: 'g1-l1', label: '중1 L1 · be동사 & 일반동사', color: '#0ea5e9', file: 'be-verb/v2.html', pattern: 'A' },
  { key: 'g1-l2', label: '중1 L2 · 현재진행형 & 동명사', color: '#6366f1', file: 'gerund-basic/index.html', pattern: 'B' },
  { key: 'g1-l3', label: '중1 L3 · be동사 과거형', color: '#22c55e', file: 'past-be/index.html', pattern: 'A' },
  { key: 'g1-l4', label: '중1 L4 · to부정사 & will/should', color: '#f59e0b', file: 'to-will-basic/index.html', pattern: 'A' },
  { key: 'g1-l5', label: '중1 L5 · 재귀대명사 & to부정사', color: '#8b5cf6', file: 'reflexive-to-basic/index.html', pattern: 'A' },
  { key: 'g1-l6', label: '중1 L6 · 감각동사 & because', color: '#ef4444', file: 'look-because-basic/index.html', pattern: 'A' },
  { key: 'g2-l1', label: '중2 L1 · 수여동사 & 관계대명사', color: '#0d9488', file: 'g2-give-relclause-basic/index.html', pattern: 'A' },
  { key: 'g2-l2', label: '중2 L2 · 현재완료 & 비교급', color: '#f97316', file: 'g2-perfect-compare-basic/index.html', pattern: 'A' },
  { key: 'g2-l3', label: '중2 L3 · 형용사 to부정사 & if', color: '#ec4899', file: 'g2-to-if-basic/index.html', pattern: 'A' },
  { key: 'g2-l4', label: '중2 L4 · so~that & 수동태', color: '#84cc16', file: 'g2-sothat-passive-basic/index.html', pattern: 'A' },
];

const result = {};
let totalOk = 0;
let errors = [];

for (const unit of UNITS) {
  const filePath = path.join(ROOT, unit.file);
  if (!fs.existsSync(filePath)) {
    console.error(`[MISSING] ${unit.file}`);
    errors.push(unit.key);
    continue;
  }
  const html = fs.readFileSync(filePath, 'utf8');
  let questions;
  if (unit.pattern === 'A') {
    questions = parsePatternA(html, unit.key.replace(/-/g, '_'));
  } else {
    questions = parsePatternB(html, unit.key.replace(/-/g, '_'));
  }

  // Validate
  const valid = questions.filter(q => q.opts.includes(q.ans) && q.eng && q.opts.length === 4);
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
