export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const key = process.env.GEMINI_API_KEY || process.env.gemini;
  if (!key) return res.status(500).json({ error: 'API key not configured' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.3 }
        })
      }
    );
    const data = await upstream.json();
    if (!upstream.ok) throw new Error(data?.error?.message || `HTTP ${upstream.status}`);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.status(200).json({ text });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
