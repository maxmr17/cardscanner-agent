const fs = require('fs');
const OpenAI = require('openai');

// Lazily initialize the client so that a missing key at startup gives a clear
// error at call time rather than crashing the module load.
let _openai = null;
function openai() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const SYSTEM_PROMPT = `You are an expert sports card identifier specializing in American football cards.
Given an image of a sports card, extract the following information and return ONLY a JSON object — no markdown, no explanation.

Required fields:
{
  "player_name": "Full player name as printed",
  "team": "NFL team name",
  "position": "Player position (e.g. QB, WR, RB)",
  "year": 2024,
  "set_name": "Card set name (e.g. Panini Prizm, Topps Chrome, Bowman)",
  "variant": "Specific variant or parallel (e.g. Silver Prizm, Gold Refractor, Base, Rookie Patch Auto)",
  "card_number": "Card number if visible (e.g. #123)",
  "condition_estimate": "Your estimate: Poor/Fair/Good/Very Good/Excellent/Near Mint/Mint",
  "confidence": 0.0,
  "notes": "Any additional identifying details"
}

If a field cannot be determined, set it to null.
confidence should be between 0.0 and 1.0 reflecting how certain you are about the identification.`;

const EXT_TO_MIME = { png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heic' };

async function identifyCard(imagePath, { retries = 2 } = {}) {
  // Use async file read to avoid blocking the event loop while reading potentially
  // large image files. fs.readFileSync would block all concurrent requests.
  const imageBuffer = await fs.promises.readFile(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const ext = imagePath.split('.').pop().toLowerCase();
  const mimeType = EXT_TO_MIME[ext] ?? 'image/jpeg';

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await openai().chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 500,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: 'high' },
              },
              { type: 'text', text: 'Identify this sports card.' },
            ],
          },
        ],
      });

      const raw = response.choices[0].message.content.trim();
      // Strip markdown code fences that some models occasionally emit.
      const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

      try {
        return JSON.parse(json);
      } catch {
        throw new Error(`GPT-4o returned non-JSON: ${raw.slice(0, 200)}`);
      }
    } catch (err) {
      lastErr = err;
      // Retry only on transient errors (rate limits, network issues).
      const isTransient =
        err?.status === 429 ||
        err?.status >= 500 ||
        err?.code === 'ECONNRESET' ||
        err?.code === 'ETIMEDOUT';

      if (!isTransient || attempt === retries) break;

      // Exponential back-off: 1 s, 2 s.
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastErr;
}

module.exports = { identifyCard };
