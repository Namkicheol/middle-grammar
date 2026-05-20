// engine/grammar.js — 문법 포인트 패턴 탐지

// 각 패턴은 { name, label, regex, explain } 형식
// regex가 일치하면 해당 문장은 그 문법 포인트 후보
const PATTERNS = [
  {
    name: 'rel-pronoun',
    label: '관계대명사',
    regex: /\b(?:people|person|man|woman|child|things?|something|nothing|anyone|everyone|strategies|product|information|things)\s+(who|which|that)\s+\w+/i,
    explain: '관계대명사 (who/which/that). 선행사를 수식하는 형용사절.'
  },
  {
    name: 'rel-pronoun-loose',
    label: '관계대명사',
    regex: /\b(who|which|that)\s+(\w+s|is|are|was|were|has|have|had|does|do|did)\b/i,
    explain: '주격 관계대명사 + 동사. 선행사와의 수 일치 주의.'
  },
  {
    name: 'passive',
    label: '수동태',
    regex: /\b(am|is|are|was|were|been|being|be)\s+\w+(ed|en)\b/i,
    explain: 'be동사 + 과거분사. 주어가 동작을 받는 의미.'
  },
  {
    name: 'to-infinitive',
    label: 'to부정사',
    regex: /\bto\s+(buy|make|get|have|do|go|see|know|think|use|find|take|help|learn|spread|influence|become|miss|fall|rely|invent)\b/i,
    explain: 'to + 동사원형. 명사적/형용사적/부사적 용법.'
  },
  {
    name: 'causative',
    label: '사역동사',
    regex: /\b(make|makes|made|let|lets|let|have|has|had|help|helps|helped)\s+(you|him|her|us|them|me|it|people|someone)\s+\w+/i,
    explain: '사역동사 + 목적어 + 동사원형/p.p.: ~가 ~하게 만들다.'
  },
  {
    name: 'comparative',
    label: '비교급/최상급',
    regex: /\b(\w+er|more\s+\w+|less\s+\w+)\s+than\b/i,
    explain: '비교급 + than: ~보다 더 ~한.'
  },
  {
    name: 'superlative',
    label: '최상급',
    regex: /\bthe\s+(\w+est|most\s+\w+|hottest|biggest|smallest|best|worst)\b/i,
    explain: 'the + 최상급: 가장 ~한.'
  },
  {
    name: 'conditional',
    label: '조건절',
    regex: /\bif\s+\w+/i,
    explain: '조건의 if절. 시간/조건 부사절에서는 현재시제가 미래를 대신.'
  },
  {
    name: 'because',
    label: '이유 종속절',
    regex: /\bbecause\b/i,
    explain: 'because 종속절: 주절의 이유를 나타냄.'
  },
  {
    name: 'gerund',
    label: '동명사',
    regex: /\b(stop|start|enjoy|finish|keep|avoid|mind|consider|begin)\s+\w+ing\b/i,
    explain: '동명사 (동사+ing): 동사 뒤 목적어로 사용.'
  },
  {
    name: '5형식',
    label: '5형식',
    regex: /\b(make|made|makes|consider|considered|call|called|name|named|find|found)\s+(you|him|her|us|them|me|it|\w+)\s+(a|an|the|\w+)/i,
    explain: '5형식: 주어 + 동사 + 목적어 + 목적보어.'
  },
  {
    name: 'sense-verb',
    label: '감각동사',
    regex: /\b(sound|sounds|sounded|look|looks|looked|feel|feels|felt|taste|tastes|smell|smells)\s+(cheap|good|bad|hot|cold|sweet|bitter|happy|sad|angry|tired|expensive|popular|smart|young|old)/i,
    explain: '감각동사 + 형용사: ~하게 ~하다.'
  }
];

// 한 문장에 매칭되는 패턴 목록
export function detect(sentence) {
  if (!sentence || !sentence.en) return [];
  const hits = [];
  for (const p of PATTERNS) {
    const m = sentence.en.match(p.regex);
    if (m) hits.push({ name: p.name, label: p.label, explain: p.explain, match: m[0] });
  }
  return dedupe(hits);
}

function dedupe(hits) {
  const seen = new Set();
  return hits.filter(h => {
    if (seen.has(h.label)) return false;
    seen.add(h.label); return true;
  });
}

// 본문 전체에서 문장별 grammar map
export function detectAll(sentences) {
  const map = new Map(); // sid → hits[]
  for (const s of sentences) {
    if (s.isHeading) continue;
    const hits = detect(s);
    if (hits.length) map.set(s.id, hits);
  }
  return map;
}

// 조각 범위에서 가장 대표적인 grammar point 1~2개
export function topForPiece(grammarMap, piece, sentences, max = 2) {
  const [a, b] = piece.range;
  const inRange = [];
  for (let i = a; i < b; i++) {
    const sid = sentences[i].id;
    const hits = grammarMap.get(sid);
    if (hits) inRange.push({ sid, hits });
  }
  // 우선순위: 패턴 복잡도(긴 라벨)·등장 횟수
  return inRange.slice(0, max);
}
