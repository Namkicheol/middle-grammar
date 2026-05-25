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
아래 전체 본문을 보고 JSON만 출력하세요 (설명 없이).

문장 목록 (i=인덱스, t: h=제목/b=본문):
${JSON.stringify(sentencesPayload)}

요청:
1. split_at: 내용 흐름(heading 기준 우선)으로 ${numPieces}개 조각 나눌 시작 인덱스 배열
   (길이=${numPieces}, 첫 항목=0, 반드시 오름차순)
2. pieces: 각 조각 A~${String.fromCharCode(64 + numPieces)} 순:
   - label: A/B/C/D
   - vocab: 조각 내 단어 한국어 뜻 {"word":"뜻"} (중학생 수준)
   - question: 영어 comprehension question 1개
   - answer: 모범 답안 (영어 완전 문장)
   - grammar_match: 문법적으로 중요한 어구 (원문 그대로)
   - grammar_explain: 한국어 문법 설명 (1~2문장)

출력 형식 (JSON만):
{"split_at":[0,5,10,15],"pieces":[{"label":"A","vocab":{"word":"뜻"},"question":"...?","answer":"...","grammar_match":"...","grammar_explain":"..."}]}`;

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
