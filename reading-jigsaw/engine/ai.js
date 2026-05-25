// engine/ai.js — /api/enrich 프록시를 통한 DeepSeek-V3 보완

export async function enrichWithAI(state) {
  const { pieces, sentences, vocabByPiece } = state;

  const piecesPayload = pieces.map((p, idx) => ({
    label: p.label,
    sentences: sentences
      .slice(p.range[0], p.range[1])
      .filter(s => !s.isHeading && s.en)
      .map(s => s.en),
    vocab: (vocabByPiece[idx] || []).map(v => v.word)
  }));

  const prompt = `중학교 영어 직소 학습지 보조 생성입니다.
아래 조각별 영어 본문을 보고 JSON만 출력하세요 (설명 없이).

각 조각에 대해:
1. vocab: 제시된 단어의 한국어 뜻 (중학생 수준, 짧게)
2. question: 본문 내용 기반 영어 comprehension question 1개
3. grammar_match: 해당 조각에서 문법적으로 중요한 어구 (원문 그대로)
4. grammar_explain: 그 어구의 한국어 문법 설명 (1~2문장)

조각 데이터:
${JSON.stringify(piecesPayload)}

출력 형식 (JSON만, 다른 텍스트 없이):
{"pieces":[{"label":"A","vocab":{"word":"뜻"},"question":"...?","grammar_match":"...","grammar_explain":"..."}]}`;

  const res = await fetch('/api/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI 응답에서 JSON을 찾지 못했습니다.');
  return JSON.parse(jsonMatch[0]);
}
