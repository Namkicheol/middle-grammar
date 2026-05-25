// engine/ai.js — /api/enrich 프록시를 통한 Gemini Flash 보완

export async function enrichWithAI(state) {
  const { pieces, sentences, vocabByPiece, grammarTarget } = state;

  const piecesPayload = pieces.map((p, idx) => ({
    label: p.label,
    sentences: sentences
      .slice(p.range[0], p.range[1])
      .filter(s => !s.isHeading && s.en)
      .map(s => s.en),
    vocab: (vocabByPiece[idx] || []).map(v => v.word)
  }));

  const targetNote = grammarTarget?.trim()
    ? `\n타겟 문법: ${grammarTarget.trim()} — grammar_match와 grammar_explain에서 이 문법 포인트를 우선 다루세요.`
    : '';

  const prompt = `중학교 영어 직소 학습지 보조 생성입니다.
아래 조각별 영어 본문을 보고 JSON만 출력하세요 (설명 없이).${targetNote}

각 조각에 대해:
1. vocab: 제시된 단어의 한국어 뜻 (중학생 수준, 짧게)
2. question: 본문 내용 기반 영어 comprehension question 1개
3. answer: question에 대한 모범 답안 (영어, 완전한 문장 1~2개)
4. grammar_match: 해당 조각에서 문법적으로 중요한 어구 (원문 그대로)
5. grammar_explain: 그 어구의 한국어 문법 설명 (1~2문장)

조각 데이터:
${JSON.stringify(piecesPayload)}

출력 형식 (JSON만, 다른 텍스트 없이):
{"pieces":[{"label":"A","vocab":{"word":"뜻"},"question":"...?","answer":"...","grammar_match":"...","grammar_explain":"..."}]}`;

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
