// engine/parser.js — 본문 텍스트 → 문장/소제목 분할
//
// 입력: 영문 본문 (옵션: 한국어 줄 — `→` 또는 `- ` 표시로 다음 줄에)
// 출력: [{ id, en, ko?, isHeading, paragraph }, ...]

const ABBREV = [
  'Mr', 'Mrs', 'Ms', 'Dr', 'Jr', 'Sr', 'St',
  'vs', 'etc', 'i.e', 'e.g', 'cf',
  'U.S', 'U.K', 'U.N', 'a.m', 'p.m', 'Ph.D',
  'No', 'Vol', 'Inc', 'Ltd', 'Co'
];

// 줄을 보고 소제목 후보인지 판정
// paragraphContext: { soloLine: true } 면 단독 paragraph로 등장 (헤딩 가능성↑)
export function looksLikeHeading(line, paragraphContext = {}) {
  const s = line.trim();
  if (!s) return false;
  if (s.length > 60) return false;
  // 화자 발화 형식 (e.g. "Junho:") 은 본문
  if (/^[A-Z][a-zA-Z]+:\s/.test(s)) return false;
  // 평서문 마침표/물음표는 본문
  if (/[.?…]['"’”\)\]]*\s*$/.test(s)) return false;
  // 느낌표는 단독 줄 + Title Case면 헤딩 허용 (예: "Be a Smart Shopper!")
  const endsExcl = /!['"’”\)\]]*\s*$/.test(s);

  const words = s.split(/\s+/);
  if (words.length < 1 || words.length > 9) return false;
  const titleCase = words.filter(w => /^[A-Z\d]/.test(w)).length;
  const titleCaseRatio = titleCase / words.length;

  if (endsExcl) {
    if (!paragraphContext.soloLine) return false;
    return titleCaseRatio >= 0.55;
  }
  // 종결부호 없음
  if (titleCaseRatio >= 0.6) return true;
  if (words.length <= 3) return true;
  return false;
}

// 한 줄을 받아 문장 단위로 split
export function splitSentences(line) {
  const out = [];
  const text = line.trim();
  if (!text) return out;

  let buf = '';
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];
    buf += ch;

    if (ch === '.' || ch === '!' || ch === '?') {
      // 1) 약어 처리
      if (ch === '.') {
        const tail = buf.match(/(\S+)\.$/);
        if (tail) {
          const w = tail[1];
          if (ABBREV.some(a => w === a || w.endsWith(' ' + a))) {
            i++; continue;
          }
          // U.S.A. 같은 패턴
          if (/^([A-Z]\.)+[A-Z]$/.test(w)) { i++; continue; }
          // 한 글자 약어 (A. B. 같은 — 잘 안 나옴)
          if (/^[A-Z]$/.test(w)) { i++; continue; }
        }
      }
      // 2) 말줄임표 ...
      if (ch === '.' && text[i+1] === '.' && text[i+2] === '.') {
        buf += text.slice(i+1, i+3);
        i += 3;
        continue;
      }
      // 3) 인용 닫는 따옴표·괄호 흡수
      let j = i + 1;
      while (j < len && /["'’”\)\]]/.test(text[j])) {
        buf += text[j]; j++;
      }
      // 4) 다음이 공백 or 끝이면 문장 종료
      if (j >= len || /\s/.test(text[j])) {
        out.push(buf.trim());
        buf = '';
        i = j;
        while (i < len && /\s/.test(text[i])) i++;
        continue;
      }
    }
    i++;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

// 라인이 한국어 해석 줄인지
function looksLikeKorean(line) {
  return /[가-힯]/.test(line);
}

// 본문 전체 파싱
// 입력 형식 두 가지 지원:
//   1) 영문만 — 줄/문단 단위
//   2) 영문 + 다음 줄 한글 해석 (`→ 해석` 또는 그냥 한글 줄)
export function parse(text) {
  const normalized = (text || '')
    .replace(/\r\n/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

  if (!normalized) return [];

  // 빈 줄 1개 이상으로 paragraph 분리
  const paragraphs = normalized.split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean);
  const sentences = [];
  let id = 0;
  let paraIdx = 0;
  let pendingKorean = null;

  for (const para of paragraphs) {
    const rawLines = para.split('\n').map(l => l.trim()).filter(Boolean);

    // 줄 단위로 영문/한글 페어링 시도
    const lines = [];
    for (const rl of rawLines) {
      const cleaned = rl.replace(/^→\s*/, '').replace(/^-\s+/, '');
      lines.push({ raw: cleaned, ko: looksLikeKorean(cleaned) });
    }

    for (let li = 0; li < lines.length; li++) {
      const cur = lines[li];

      // 한글 줄: 직전 영문 문장에 ko 붙이기
      if (cur.ko) {
        const last = sentences[sentences.length - 1];
        if (last && !last.ko && !last.isHeading) {
          last.ko = cur.raw;
        } else {
          // 영문 없는 한글만 — 단독으로 push (학생 input 영역)
          sentences.push({
            id: id++,
            en: '',
            ko: cur.raw,
            isHeading: false,
            paragraph: paraIdx,
            koOnly: true
          });
        }
        continue;
      }

      // 영문 줄
      const isSolo = lines.filter(l => !l.ko).length === 1;
      if (looksLikeHeading(cur.raw, { soloLine: isSolo })) {
        sentences.push({
          id: id++,
          en: cur.raw,
          isHeading: true,
          paragraph: paraIdx
        });
        continue;
      }
      const parts = splitSentences(cur.raw);
      for (const p of parts) {
        sentences.push({
          id: id++,
          en: p,
          isHeading: false,
          paragraph: paraIdx
        });
      }
    }
    paraIdx++;
  }

  return sentences;
}

// 통계
export function stats(sentences) {
  const total = sentences.length;
  const headings = sentences.filter(s => s.isHeading).length;
  const bodies = total - headings;
  const totalWords = sentences.reduce((sum, s) => {
    if (s.isHeading || !s.en) return sum;
    return sum + s.en.split(/\s+/).filter(Boolean).length;
  }, 0);
  const avgWords = bodies ? Math.round(totalWords / bodies * 10) / 10 : 0;
  return { total, headings, bodies, totalWords, avgWords };
}
