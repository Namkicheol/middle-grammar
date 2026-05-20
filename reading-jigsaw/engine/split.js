// engine/split.js — 본문 → 조각(A/B/C…) 자동 분할 + 별점

// 본문 문장 배열을 받아 N조각으로 자동 분할
// 우선순위: (1) 소제목 경계 (2) 문장 수 균등
export function autoSplit(sentences, opts = {}) {
  if (!sentences.length) return [];

  // 소제목 인덱스 — 첫 줄(=0)은 boundary로 의미 없음
  const headingIdx = sentences
    .map((s, i) => (s.isHeading && i > 0 ? i : -1))
    .filter(i => i >= 0);

  // target: 사용자 지정 > 헤딩 수(있으면) > 길이 기반
  const target = opts.target
    || (headingIdx.length > 0 ? Math.max(3, Math.min(5, headingIdx.length + 1)) : pickTarget(sentences));

  let boundaries;

  if (headingIdx.length >= target - 1) {
    // 소제목으로 분할 — 균등에 가깝게 선택
    boundaries = pickEvenly(headingIdx, target - 1, sentences.length);
  } else if (headingIdx.length > 0) {
    // 헤딩이 있지만 부족하면 헤딩을 우선 사용하고 부족분은 균등 분할로 채움
    boundaries = [...headingIdx];
    const need = target - 1 - boundaries.length;
    if (need > 0) {
      const total = sentences.length;
      for (let i = 1; i <= need; i++) {
        const bp = Math.round((total * i) / (need + 1));
        if (!boundaries.includes(bp)) boundaries.push(bp);
      }
      boundaries.sort((a, b) => a - b);
    }
  } else {
    // 균등 분할
    boundaries = [];
    const bodyCount = sentences.length;
    for (let i = 1; i < target; i++) {
      boundaries.push(Math.round((bodyCount * i) / target));
    }
  }

  // boundaries → 범위로 변환
  const ranges = [];
  let start = 0;
  for (const b of boundaries) {
    ranges.push([start, b]);
    start = b;
  }
  ranges.push([start, sentences.length]);

  // 라벨 + 메타
  return ranges.map((r, idx) => buildPiece(idx, r, sentences));
}

function pickTarget(sentences) {
  const bodies = sentences.filter(s => !s.isHeading).length;
  if (bodies <= 10) return 3;
  if (bodies <= 20) return 4;
  return 5;
}

function pickEvenly(candidates, count, total) {
  // candidates 중에서 count개를 균등 분포로 선택
  if (count <= 0) return [];
  if (candidates.length <= count) return [...candidates];
  const out = [];
  const step = total / (count + 1);
  for (let i = 1; i <= count; i++) {
    const ideal = step * i;
    // candidates 중 ideal에 가장 가까운 것 (중복 회피)
    let best = candidates[0], bestDiff = Math.abs(candidates[0] - ideal);
    for (const c of candidates) {
      if (out.includes(c)) continue;
      const d = Math.abs(c - ideal);
      if (d < bestDiff) { best = c; bestDiff = d; }
    }
    out.push(best);
  }
  out.sort((a, b) => a - b);
  return out;
}

function buildPiece(idx, [a, b], sentences) {
  const range = sentences.slice(a, b);
  const heading = range.find(s => s.isHeading);
  const bodies = range.filter(s => !s.isHeading && !s.koOnly);
  const wordCount = bodies.reduce(
    (sum, s) => sum + (s.en ? s.en.split(/\s+/).filter(Boolean).length : 0),
    0
  );
  const stars = estimateStars(bodies, wordCount);
  const label = String.fromCharCode(65 + idx); // A,B,C…
  return {
    id: idx,
    label,
    range: [a, b],
    heading: heading ? heading.en : null,
    sentenceCount: bodies.length,
    wordCount,
    stars
  };
}

// 별점 (1~3)
// 평균 문장 길이 + 문법 복잡도(추정) 기반
function estimateStars(bodies, totalWords) {
  if (!bodies.length) return 1;
  const avgLen = totalWords / bodies.length;
  let score = 0;
  if (avgLen >= 10) score++;
  if (avgLen >= 15) score++;

  // 복잡 구조 패턴
  const text = bodies.map(s => s.en).join(' ');
  const patterns = [
    /\b(who|which|that|whose|whom)\s+\w/i,            // 관계대명사
    /\b(was|were|been|being|is|are|am|be)\s+\w+ed\b/i, // 수동태 (단순)
    /\bto\s+\w+/i,                                     // to부정사 (단순)
    /\bbecause\b|\bthough\b|\balthough\b|\bif\b/i,     // 종속절
    /\bmake|let|have|help\s+\w+\s+\w+/i               // 사역동사
  ];
  let hits = 0;
  for (const p of patterns) if (p.test(text)) hits++;
  if (hits >= 2) score++;
  if (hits >= 4) score++;

  return Math.max(1, Math.min(3, Math.round(score / 2) + 1));
}

// 사용자 수동 경계 이동 (조각 i의 끝을 sentenceIdx로)
export function moveBoundary(pieces, sentences, pieceIdx, newEnd) {
  const total = sentences.length;
  newEnd = Math.max(pieces[pieceIdx].range[0] + 1, Math.min(total - 1, newEnd));
  const updated = pieces.map((p, i) => {
    if (i === pieceIdx) return rangeUpdate(p, [p.range[0], newEnd], sentences);
    if (i === pieceIdx + 1) return rangeUpdate(p, [newEnd, p.range[1]], sentences);
    return p;
  });
  return updated;
}

function rangeUpdate(piece, [a, b], sentences) {
  const range = sentences.slice(a, b);
  const heading = range.find(s => s.isHeading);
  const bodies = range.filter(s => !s.isHeading && !s.koOnly);
  const wordCount = bodies.reduce(
    (sum, s) => sum + (s.en ? s.en.split(/\s+/).filter(Boolean).length : 0),
    0
  );
  return {
    ...piece,
    range: [a, b],
    heading: heading ? heading.en : null,
    sentenceCount: bodies.length,
    wordCount,
    stars: estimateStars(bodies, wordCount)
  };
}

// 조각 추가/제거
export function insertBoundary(pieces, sentences, atSentenceIdx) {
  // 어느 조각에 속해 있는지
  const piIdx = pieces.findIndex(p => atSentenceIdx > p.range[0] && atSentenceIdx < p.range[1]);
  if (piIdx === -1) return pieces;
  const target = pieces[piIdx];
  const left = rangeUpdate(target, [target.range[0], atSentenceIdx], sentences);
  const right = rangeUpdate(
    { id: target.id + 1, label: '', stars: 1 },
    [atSentenceIdx, target.range[1]],
    sentences
  );
  const next = [...pieces.slice(0, piIdx), left, right, ...pieces.slice(piIdx + 1)];
  return relabel(next);
}

export function removeBoundary(pieces, sentences, pieceIdx) {
  // pieceIdx와 pieceIdx+1 합치기
  if (pieceIdx >= pieces.length - 1) return pieces;
  const merged = rangeUpdate(
    pieces[pieceIdx],
    [pieces[pieceIdx].range[0], pieces[pieceIdx + 1].range[1]],
    sentences
  );
  const next = [...pieces.slice(0, pieceIdx), merged, ...pieces.slice(pieceIdx + 2)];
  return relabel(next);
}

function relabel(pieces) {
  return pieces.map((p, i) => ({ ...p, id: i, label: String.fromCharCode(65 + i) }));
}
