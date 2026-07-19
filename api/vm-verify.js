// Vercel serverless function — AI verification of VM/display photos.
// POST /api/vm-verify  { image: <base64 no prefix>, mediaType: "image/jpeg", storeName?: string }
// Requires ANTHROPIC_API_KEY in Vercel env settings. Without it, returns
// { ok: false, configured: false } so the app falls back to manual review.

const Anthropic = require('@anthropic-ai/sdk');

const SCHEMA = {
  type: 'object',
  properties: {
    display_correct:  { type: 'boolean', description: 'Products displayed per standard retail VM practice' },
    promo_visible:    { type: 'boolean', description: 'Promotional material present and correctly placed (true if no promo is expected)' },
    color_blocking:   { type: 'boolean', description: 'Colors grouped/blocked coherently' },
    cleanliness:      { type: 'boolean', description: 'Store area clean and uncluttered' },
    mannequin_styling:{ type: 'boolean', description: 'Mannequins styled correctly (true if none visible)' },
    score:            { type: 'integer', description: 'Overall VM score 0-100' },
    pass:             { type: 'boolean', description: 'true when score is 70 or above' },
    feedback:         { type: 'string',  description: 'Two short sentences: what is good, and the single most important improvement' }
  },
  required: ['display_correct', 'promo_visible', 'color_blocking', 'cleanliness', 'mannequin_styling', 'score', 'pass', 'feedback'],
  additionalProperties: false
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method not allowed' }); return; }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(200).json({ ok: false, configured: false, error: 'AI verification not configured. Add ANTHROPIC_API_KEY in Vercel environment settings.' });
    return;
  }

  let body;
  try {
    const buf = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
    body = JSON.parse(buf.toString('utf8'));
  } catch (e) {
    body = req.body;
  }
  if (!body || !body.image) { res.status(400).json({ ok: false, error: 'Missing image' }); return; }

  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: body.mediaType || 'image/jpeg', data: body.image }
          },
          {
            type: 'text',
            text: `You are a visual merchandising auditor for Intimissi, a premium lingerie retail chain in India${body.storeName ? ` (store: ${body.storeName})` : ''}. ` +
              'Audit this store display/VM photo against the criteria in the schema. Be fair but rigorous: a tidy, well-blocked, on-brand display scores 80+; ' +
              'visible clutter, empty fixtures, mixed colour chaos, or missing/damaged signage pull the score down. pass = score >= 70.'
          }
        ]
      }]
    });

    if (response.stop_reason === 'refusal') {
      res.status(200).json({ ok: false, configured: true, error: 'The AI declined to analyse this image. Please review manually.' });
      return;
    }
    const text = response.content.find(b => b.type === 'text');
    const result = JSON.parse(text.text);
    res.status(200).json({ ok: true, configured: true, result });
  } catch (e) {
    res.status(200).json({ ok: false, configured: true, error: 'AI verification failed: ' + (e.message || 'unknown error') });
  }
};
