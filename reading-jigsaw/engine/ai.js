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

  // 추출된 단어를 빈 값 템플릿으로 전달 → AI가 값을 채워 반환 (누락 방지)
  // 실제 학습지에 표시되는 단어(vocabByPiece) 기준 — 화면 단어 ≠ 질문 단어 불일치 방지
  const displayedWords = [];
  const seenWord = new Set();
  for (const list of Object.values(state.vocabByPiece || {})) {
    for (const v of list) {
      const lc = (v.word || '').toLowerCase();
      if (v.word && !seenWord.has(lc)) { seenWord.add(lc); displayedWords.push(v.word); }
    }
  }
  const wordsForTemplate = displayedWords.length
    ? displayedWords
    : (state.vocab || []).slice(0, 40).map(v => v.word);
  const vocabTemplate = Object.fromEntries(wordsForTemplate.map(w => [w, '']));

  const prompt = `중학교 영어 직소 학습지 보조입니다.
아래 전체 본문을 보고 JSON만 출력하세요 (다른 텍스트 없이).

문장 목록 (i=문장인덱스, t: h=소제목/b=본문):
${JSON.stringify(sentencesPayload)}

출력할 내용:
1. split_at: i값 기준으로 ${numPieces}개 조각 나눌 시작 인덱스 배열
   (길이=${numPieces}, 첫값=0, 오름차순, 소제목 h의 i값 우선 사용)
2. vocab_meanings: 아래 JSON 템플릿의 빈 값("")을 한국어 뜻으로 채워서 반환하세요.
   모든 키를 그대로 유지하고 값만 채우세요. 단 하나도 빠뜨리지 마세요.
   템플릿: ${JSON.stringify(vocabTemplate)}
3. pieces: split_at 순서대로 A~${String.fromCharCode(64 + numPieces)}:
   - label: "A"/"B"/"C"/"D"
   - question: 조각에서 사실 1가지만 묻는 짧은 영어 질문 (10단어 이내, and/or로 두 가지 묻지 말 것)
   - answer: 10단어 이내 짧은 1문장 (핵심 사실만, 설명 금지)

출력 형식 (JSON만):
{"split_at":[0,5,12,20],"vocab_meanings":{"strategies":"전략들","shopper":"구매자"},"pieces":[{"label":"A","question":"What strategies are introduced?","answer":"Hunger and viral marketing are introduced."}]}`;

  return callAPI(prompt);
}

// Phase 1.5 — 문장 번역 (Phase 1 완료 후 별도 호출)
export async function translateSentences(state) {
  const bodyMap = {};
  state.sentences.forEach((s, i) => {
    if (!s.isHeading && s.en && !s.ko) bodyMap[i] = s.en;
  });
  if (!Object.keys(bodyMap).length) return {};

  const prompt = `아래 영어 문장들을 중학생 수준의 자연스러운 한국어로 번역하세요.
JSON만 출력하세요 (키=인덱스, 값=한국어번역).
중요: 사람 이름·고유명사는 한글로 음역하지 말고 영어 원문 그대로 두세요. (예: Emma → Emma, Junho → Junho)

${JSON.stringify(bodyMap)}

출력 형식: {"1":"번역","2":"번역",...}`;

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
- explain: 중학생 눈높이 한국어 문법 설명 (1~2문장). 사람 이름·고유명사는 영어 원문 그대로(한글 음역 금지).
- askTranslation: 해석이 까다롭거나 구조 이해에 번역이 중요한 경우 true, 단순 형태 문법은 false
  예: 관계절·부정사구·분사구·수동태·간접의문문 → true / 단순 조동사·비교급 → false

출력 형식 (JSON만):
{"pieces":[{"label":"A","candidates":[{"match":"which influence your decisions","explain":"관계대명사 which가 선행사 strategies를 수식하는 관계절입니다.","askTranslation":true},{"match":"will have to","explain":"will have to는 '~해야 할 것이다'라는 미래 의무 표현입니다.","askTranslation":false}]}]}`;

  return callAPI(prompt);
}

// 질문 추가 — 각 조각에 기존 질문과 겹치지 않는 새 영어 질문 1개 + 짧은 답
export async function addQuestions(state) {
  const piecesPayload = state.pieces.map(p => ({
    label: p.label,
    sentences: state.sentences.slice(p.range[0], p.range[1]).filter(s => !s.isHeading && s.en).map(s => s.en),
    existing: [p.aiQuestion, ...((p.extraQ || []).map(x => x.q))].filter(Boolean)
  }));
  const prompt = `중학교 영어 직소 학습지입니다. 각 조각 본문을 보고 기존 질문과 겹치지 않는 새 영어 comprehension question 1개와 10단어 이내 짧은 답을 만드세요.
사람 이름·고유명사는 영어 원문 그대로.

조각 데이터:
${JSON.stringify(piecesPayload)}

출력 형식 (JSON만):
{"pieces":[{"label":"A","question":"What do trees share underground?","answer":"They share information."}]}`;
  return callAPI(prompt);
}
