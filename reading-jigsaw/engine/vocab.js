// engine/vocab.js — 본문에서 학습 대상 어휘 추출

// 일반 영단어 stopwords (어휘 후보에서 제외)
const STOPWORDS = new Set([
  'a','an','the','and','or','but','so','because','if','when','while','as',
  'is','am','are','was','were','be','been','being','do','does','did','done',
  'have','has','had','having','will','would','can','could','shall','should',
  'may','might','must','need','ought','dare','let',
  'i','you','he','she','it','we','they','me','him','her','us','them',
  'my','your','his','its','our','their','mine','yours','hers','ours','theirs',
  'this','that','these','those','there','here','where','when','why','how',
  'who','whom','whose','which','what',
  'in','on','at','to','from','by','with','for','of','about','into','onto',
  'over','under','through','out','up','down','off','away','around','near',
  'between','among','behind','before','after','during','since','until',
  'not','no','yes','very','too','also','just','only','still','already',
  'all','some','any','every','each','many','much','few','little','more','most',
  'one','two','three','four','five','six','seven','eight','nine','ten','first','second',
  'now','then','soon','today','tomorrow','yesterday',
  'say','said','says','tell','told','tells','ask','asked','asks',
  'go','went','gone','goes','come','came','comes','get','got','gets','make','made','makes',
  'see','saw','seen','look','looked','looks','feel','felt','feels','think','thought','thinks',
  'know','knew','known','knows','want','wanted','wants','like','liked','likes',
  'good','bad','big','small','old','new','long','short','high','low','right','wrong',
  'lot','lots','really','much','very','quite','rather','enough'
]);

// 본문 + 해당 단원의 기본 단어 풀(있으면 차집합)을 받아 학습 어휘 추출
export function extract(sentences, opts = {}) {
  const knownPool = new Set((opts.known || []).map(w => w.toLowerCase()));
  const wordMap = new Map(); // lowercase → { word, count, firstSid }

  for (const s of sentences) {
    if (s.isHeading || !s.en) continue;
    const tokens = tokenize(s.en);
    for (const t of tokens) {
      const lc = t.toLowerCase();
      if (STOPWORDS.has(lc)) continue;
      if (lc.length < 3) continue;
      // 인명 추정 (대문자 + 본문에서 1~2회만 등장) → 일단 포함 후 후처리
      if (!wordMap.has(lc)) {
        wordMap.set(lc, { word: t, count: 1, firstSid: s.id, sids: new Set([s.id]) });
      } else {
        const v = wordMap.get(lc);
        v.count++;
        v.sids.add(s.id);
      }
    }
  }

  // 결과
  const candidates = [];
  for (const [lc, v] of wordMap) {
    if (knownPool.has(lc)) continue;
    if (isProbablyName(v.word, v.count)) continue;
    candidates.push({
      word: v.word.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, ''),
      lc,
      count: v.count,
      firstSid: v.firstSid,
      sids: v.sids
    });
  }
  // 빈도 낮은(=새 단어 가능성 큰) 것 우선
  candidates.sort((a, b) => a.count - b.count || a.firstSid - b.firstSid);
  return candidates;
}

// 조각 범위에 해당하는 어휘만 필터 (범위 내 어디든 등장하면 포함)
export function pickForPiece(allCandidates, piece, sentences, max = 10) {
  const [a, b] = piece.range;
  const ids = new Set(sentences.slice(a, b).map(s => s.id));
  const inRange = allCandidates.filter(c =>
    c.sids ? [...c.sids].some(id => ids.has(id)) : ids.has(c.firstSid)
  );
  return inRange.slice(0, max);
}

function tokenize(line) {
  // 따옴표·괄호·구두점 제거, 단어 단위 분리
  const cleaned = line.replace(/[".,!?;:()"‘’“”]/g, ' ');
  return cleaned.split(/\s+/).filter(w => /^[a-zA-Z][a-zA-Z'-]*$/.test(w));
}

function isProbablyName(word, count) {
  // 대문자 시작 + 등장 횟수 적음 + stopword 아님 → 인명/고유명사 가능성
  if (count > 3) return false;
  if (!/^[A-Z]/.test(word)) return false;
  // 흔한 영어 대문자 시작어 (문장 첫 단어)는 stopword에서 걸렀음
  // 그래도 일반 명사 가능성이 있어 false
  // 정말 인명만 거르려면 사전 비교 필요 — 여기선 휴리스틱
  return word.length >= 3 && count <= 2;
}
