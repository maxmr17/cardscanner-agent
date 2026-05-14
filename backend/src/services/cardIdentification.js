const fs = require('fs');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

async function identifyCard(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const ext = imagePath.split('.').pop().toLowerCase();
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const response = await openai.chat.completions.create({
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

  // Strip markdown code fences if present
  const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(`GPT-4o returned non-JSON response: ${raw.slice(0, 200)}`);
  }

  return parsed;
}

module.exports = { identifyCard };
