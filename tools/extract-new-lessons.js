// 일회성: 워크시트엔 있으나 게임(questions.js)엔 없는 6개 단원만 추출한다.
//   중1 L7,L8 / 중2 L5~L8. 기존 손수 보강 단원은 건드리지 않는다(append용 스니펫만 생성).
// 출력: /tmp/new-lessons-snippet.txt (questions.js의 "all" 앞에 그대로 끼워넣을 JSON 조각)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

function stripHtml(s) {
  return s.replace(/<span\s+class=["']ex["'][^>]*>[\s\S]*?<\/span>/g, '')
          .replace(/<em>___<\/em>/g, '___')
          .replace(/<input\b[^>]*>/g, '___')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ').trim();
}
function norm(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function attr(tag, name) {
  const re = new RegExp(name + "\\s*=\\s*([\"'])(.*?)\\1");
  const m = tag.match(re); return m ? m[2].trim() : '';
}
function unique(items) {
  const seen = new Set();
  return items.filter(it => { const k = norm(it); if (!k || seen.has(k)) return false; seen.add(k); return true; });
}
function splitInlineKor(text, fallbackKor) {
  const clean = String(text || '').trim();
  if (!clean.startsWith('🇰🇷')) return { eng: clean, kor: fallbackKor || '' };
  const withoutFlag = clean.replace(/^🇰🇷\s*/, '');
  const m = withoutFlag.match(/^(.+?[.!?])\s+([A-Z][\s\S]*)$/);
  if (!m) return { eng: withoutFlag, kor: fallbackKor || '' };
  return { eng: m[2].trim(), kor: fallbackKor || m[1].trim() };
}
function parsePatternA(html, unitKey) {
  const questions = [];
  const blocks = html.split(/<div\s+class=["']question-card["']/); blocks.shift();
  let idx = 0;
  for (const block of blocks) {
    const idMatch = block.match(/id=["']qc-([^"']+)["']/);
    let qid = idMatch ? idMatch[1] : `q${++idx}`;
    let ans = '';
    const opts = [];
    // class='choices' 뿐 아니라 class='choices choices full'(긴 문장 고르기) 등 다중 클래스도 매칭
    const choiceSection = block.match(/<div\b[^>]*class=["'][^"']*\bchoices\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/);
    if (choiceSection) {
      const choiceTag = choiceSection[0].match(/<div\b[^>]*>/);
      if (choiceTag) { qid = attr(choiceTag[0], 'data-qid') || qid; ans = attr(choiceTag[0], 'data-ans'); }
      let m; const choiceRe = /<button\b[^>]*class=["']choice["'][^>]*>([\s\S]*?)<\/button>/g;
      while ((m = choiceRe.exec(choiceSection[1])) !== null) opts.push(stripHtml(m[1]));
    }
    if (/q-type\s+fix|q-type\s+arr/.test(block)) continue;
    if (opts.length === 0) continue;
    if (!ans) continue;
    const qtextMatch = block.match(/<div\b[^>]*class=["']q-text["'][^>]*>([\s\S]*?)<\/div>/);
    let eng = qtextMatch ? stripHtml(qtextMatch[1]) : '';
    // 게임 부적합: "틀린/어색한 것을 고르세요" → 정답이 비문이라 게임에서 초록불로 강조되면 오개념. 제외.
    if (/맞지\s*않|틀린\s*(것|문장)|어색한/.test(eng)) continue;
    const korMatch = block.match(/<div\b[^>]*class=["']q-kor["'][^>]*>([\s\S]*?)<\/div>/);
    const hintMatch = block.match(/📝\s*해석:\s*([\s\S]*?)<\/div>/);
    let kor = korMatch ? stripHtml(korMatch[1]) : hintMatch ? stripHtml(hintMatch[1]) : '';
    ({ eng, kor } = splitInlineKor(eng, kor));
    const cleanOpts = unique(opts);
    if (cleanOpts.length > 0 && !cleanOpts.some(o => norm(o) === norm(ans))) cleanOpts.unshift(ans);
    questions.push({ id: `${unitKey}_${qid}`, kor, eng, ans, opts: cleanOpts });
  }
  return questions;
}
function fillOptions(questions) {
  const answerBank = unique(questions.map(q => q.ans));
  return questions.map((q, index) => {
    const opts = unique([q.ans, ...(q.opts || [])]);
    const sorted = answerBank.filter(a => norm(a) !== norm(q.ans))
      .sort((a, b) => Math.abs(a.length - q.ans.length) - Math.abs(b.length - q.ans.length));
    for (const a of sorted) { if (opts.length >= 4) break; opts.push(a); }
    const four = opts.slice(0, 4);
    const shift = index % four.length;
    return { ...q, opts: [...four.slice(shift), ...four.slice(0, shift)] };
  });
}

const UNITS = [
  { key: 'g1-l7', label: '중1 L7 · make+형용사 & 접속사 that', color: '#d946ef',
    files: [{ file: 'make-that-basic/index.html' }, { file: 'make-that-hard/index.html' }] },
  { key: 'g1-l8', label: '중1 L8 · 감탄문 & -thing+형용사', color: '#06b6d4',
    files: [{ file: 'exclaim-something-basic/index.html' }, { file: 'exclaim-something-hard/index.html' }] },
  { key: 'g2-l5', label: '중2 L5 · 동사+목적어+to부정사 & 목적격 관계대명사', color: '#8b5cf6',
    files: [{ file: 'g2-want-relclause-basic/index.html' }, { file: 'g2-want-relclause-hard/index.html' }] },
  { key: 'g2-l6', label: '중2 L6 · 지각동사 & 간접의문문', color: '#f43f5e',
    files: [{ file: 'g2-perceive-indirectq-basic/index.html' }, { file: 'g2-perceive-indirectq-hard/index.html' }] },
  { key: 'g2-l7', label: '중2 L7 · 사역동사 & 원급 비교', color: '#10b981',
    files: [{ file: 'g2-causative-asas-basic/index.html' }, { file: 'g2-causative-asas-hard/index.html' }] },
  { key: 'g2-l8', label: '중2 L8 · 가주어 it & 의문사+to부정사', color: '#eab308',
    files: [{ file: 'g2-itto-whatto-basic/index.html' }, { file: 'g2-itto-whatto-hard/index.html' }] },
];

const result = {};
let total = 0;
for (const unit of UNITS) {
  let questions = [];
  for (const source of unit.files) {
    const filePath = path.join(ROOT, source.file);
    if (!fs.existsSync(filePath)) { console.error(`[MISSING] ${source.file}`); continue; }
    const html = fs.readFileSync(filePath, 'utf8');
    const prefix = unit.key.replace(/-/g, '_') + '_' + source.file.replace(/\.[^.]*$/, '').replace(/\W+/g, '_');
    const level = /hard|심화|practice/.test(source.file) ? 2 : 1;
    const parsed = parsePatternA(html, prefix);
    parsed.forEach(q => { q.level = level; });
    questions.push(...parsed);
  }
  questions.sort((a, b) => (a.level || 1) - (b.level || 1));
  questions = fillOptions(questions);
  const valid = questions.filter(q => q.opts.some(o => norm(o) === norm(q.ans)) && q.eng && q.opts.length === 4);
  // 중복 id 제거(혹시 모를 충돌)
  const seenId = new Set();
  const deduped = valid.filter(q => { if (seenId.has(q.id)) return false; seenId.add(q.id); return true; });
  console.log(`[OK] ${unit.key}: ${deduped.length} MCQ (dropped ${questions.length - deduped.length})`);
  result[unit.key] = { label: unit.label, color: unit.color, questions: deduped };
  total += deduped.length;
}
console.log(`\nTotal new: ${total} across ${UNITS.length} units`);

// "all" 앞에 끼워넣을 조각 — 최상위 2-space 들여쓰기에 맞춤
const full = JSON.stringify(result, null, 2);          // { "g1-l7": {...}, ... }
const inner = full.replace(/^\{\n/, '').replace(/\n\}\s*$/, '');  // 바깥 중괄호 제거 → 키가 2-space
fs.writeFileSync('/tmp/new-lessons-snippet.txt', inner + ',\n', 'utf8');
console.log('snippet → /tmp/new-lessons-snippet.txt');
