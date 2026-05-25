export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const key = process.env.DEEPSEEK_API_KEY || process.env.deepseek;
  if (!key) return res.status(500).json({ error: 'API key not configured' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  try {
    const upstream = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 5000,
        temperature: 0.3
      })
    });
    const data = await upstream.json();
    if (!upstream.ok) throw new Error(data?.error?.message || `HTTP ${upstream.status}`);
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error(`빈 응답 (model=${data.model}, finish=${data.choices?.[0]?.finish_reason})`);
    res.status(200).json({ text });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
