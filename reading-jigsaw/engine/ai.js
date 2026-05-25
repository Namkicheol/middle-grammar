// engine/ai.js — /api/enrich 프록시를 통한 DeepSeek V4 Flash 보완

export async function enrichWithAI(state) {
  const { sentences, grammarTarget } = state;
  const numPieces = state.pieces.length || 4;

  const sentencesPayload = sentences
    .map((s, i) => ({ i, t: s.isHeading ? 'h' : 'b', en: s.en }))
    .filter(s => s.en);

  const targetNote = grammarTarget?.trim()
    ? `\n타겟 문법: ${grammarTarget.trim()} — grammar_match/explain에서 이 문법 포인트 우선.`
    : '';

  const prompt = `중학교 영어 직소 학습지 보조 생성입니다.${targetNote}
아래 전체 본문을 보고 JSON만 출력하세요 (다른 텍스트 절대 없이, JSON만).

문장 목록 (i=문장인덱스, t: h=소제목/b=본문):
${JSON.stringify(sentencesPayload)}

출력할 내용:
1. split_at: i값 기준으로 본문을 ${numPieces}개 조각으로 나눌 각 시작 i값 배열
   규칙: 길이=${numPieces}, 첫값=0, 오름차순, h(소제목) i값 우선 사용
   예시: [0, 5, 12, 20]
2. pieces: split_at 순서대로 A부터 ${String.fromCharCode(64 + numPieces)}까지:
   - label: "A" / "B" / "C" / "D"
   - vocab: 해당 조각 본문에 나오는 어려운 단어와 한국어 뜻을 {"영어단어":"한국어뜻"} 형태로
     예시: {"strategy":"전략", "influence":"영향을 미치다", "limited":"제한된"}
   - question: 해당 조각 내용을 묻는 영어 질문 1개 (의문문)
   - answer: question의 모범 답안 (영어 완전 문장 1~2개)
   - grammar_match: 해당 조각 본문에서 문법 포인트가 되는 어구를 원문 그대로 복사
     예시: "which influence your decisions"
   - grammar_explain: grammar_match의 한국어 문법 설명 (1~2문장)

출력 형식 (JSON만, 다른 텍스트 없이):
{"split_at":[0,5,12,20],"pieces":[{"label":"A","vocab":{"strategy":"전략","influence":"영향을 미치다"},"question":"What marketing strategies are mentioned?","answer":"Hunger marketing and viral marketing are mentioned.","grammar_match":"which influence your decisions","grammar_explain":"관계대명사 which가 선행사 strategies를 수식하는 관계절입니다."}]}`;

  const res = await fetch('/api/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `HTTP ${res.status}`);
  }

  const { text } = await res.json();
  const jsonMatch = text?.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI 응답에서 JSON을 찾지 못했습니다.');
  return JSON.parse(jsonMatch[0]);
}
