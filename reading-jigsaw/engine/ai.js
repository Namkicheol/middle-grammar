// engine/ai.js — /api/enrich 프록시를 통한 AI 보완

async function callAPI(prompt) {
  const res = await fetch('/api/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `HTTP ${res.status}`);
  }
  const { text, error } = await res.json();
  if (error) throw new Error(error);
  const jsonMatch = text?.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI 응답에서 JSON을 찾지 못했습니다.');
  return JSON.parse(jsonMatch[0]);
}

// Phase 1 — 분할 + 단어뜻 + 질문 (자동 실행)
export async function enrichWithAI(state) {
  const { sentences } = state;
  const numPieces = Math.min(state.pieces.length || 4, 4);

  const sentencesPayload = sentences
    .map((s, i) => ({ i, t: s.isHeading ? 'h' : 'b', en: s.en }))
    .filter(s => s.en);

  // 추출된 단어 원형 그대로 전달 → AI가 동일한 키로 뜻 반환
  const vocabWords = (state.vocab || []).slice(0, 40).map(v => v.word);

  const prompt = `중학교 영어 직소 학습지 보조입니다.
아래 전체 본문을 보고 JSON만 출력하세요 (다른 텍스트 없이).

문장 목록 (i=문장인덱스, t: h=소제목/b=본문):
${JSON.stringify(sentencesPayload)}

단어 목록 (아래 단어들의 한국어 뜻을 vocab_meanings에 넣으세요):
${JSON.stringify(vocabWords)}

출력할 내용:
1. split_at: i값 기준으로 ${numPieces}개 조각 나눌 시작 인덱스 배열
   (길이=${numPieces}, 첫값=0, 오름차순, 소제목 h의 i값 우선 사용)
2. vocab_meanings: 단어 목록의 모든 단어에 대한 한국어 뜻 객체
   (목록의 모든 단어를 반드시 포함. 쉬운 단어도 생략 금지. 키는 단어 목록과 정확히 동일한 철자)
   예: {"strategies":"전략들","influence":"영향을 미치다","limited":"제한된","smart":"똑똑한"}
3. pieces: split_at 순서대로 A~${String.fromCharCode(64 + numPieces)}:
   - label: "A"/"B"/"C"/"D"
   - question: 조각 내용을 묻는 영어 질문 1개 (의문문)
   - answer: question의 모범 답안 (영어 완전 문장)

출력 형식 (JSON만):
{"split_at":[0,5,12,20],"vocab_meanings":{"strategies":"전략들","influence":"영향을 미치다"},"pieces":[{"label":"A","question":"What marketing strategies are introduced?","answer":"Hunger marketing and viral marketing are introduced."}]}`;

  return callAPI(prompt);
}

// Phase 2 — 문법 포인트 후보 추출 (AI 버튼 수동 실행)
export async function extractGrammarCandidates(state) {
  const { pieces, sentences, grammarTarget } = state;

  const piecesPayload = pieces.map((p, idx) => ({
    label: p.label,
    sentences: sentences
      .slice(p.range[0], p.range[1])
      .filter(s => !s.isHeading && s.en)
      .map(s => s.en)
  }));

  const targetNote = grammarTarget?.trim()
    ? `\n타겟 문법: ${grammarTarget.trim()} — 이 문법과 관련된 어구를 우선 추출하세요.`
    : '';

  const prompt = `중학교 영어 직소 학습지 문법 포인트 추출입니다.${targetNote}
각 조각에서 중학생 수준의 문법 포인트가 되는 어구를 최대 3개씩 추출하세요.

조각 데이터:
${JSON.stringify(piecesPayload)}

규칙:
- match: 해당 조각 본문 문장에서 원문 그대로 복사한 어구 (수식어 포함 자연스러운 단위)
  예: "which influence your decisions", "Learning about them", "will have to buy them"
- explain: 중학생 눈높이 한국어 문법 설명 (1~2문장)

출력 형식 (JSON만):
{"pieces":[{"label":"A","candidates":[{"match":"which influence your decisions","explain":"관계대명사 which가 선행사 strategies를 수식하는 관계절입니다."},{"match":"Learning about them","explain":"동명사(V-ing)가 문장의 주어로 사용된 형태입니다."}]}]}`;

  return callAPI(prompt);
}
