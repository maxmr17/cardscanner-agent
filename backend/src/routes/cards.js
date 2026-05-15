const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { upload, validateMagicBytes } = require('../middleware/upload');
const { identifyCard } = require('../services/cardIdentification');
const { upsertValuation } = require('../services/valuation');

const router = express.Router();

// POST /cards/scan
router.post('/scan', authenticate, upload.single('image'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

  // Clean up the uploaded file in all error paths.
  const cleanup = () => fs.unlink(req.file.path, () => {});

  // Magic-byte validation (prevents MIME spoofing that passed the first-pass filter).
  const magicErr = await validateMagicBytes(req.file.path);
  if (magicErr) {
    cleanup();
    return res.status(400).json({ error: magicErr });
  }

  let identification;
  try {
    identification = await identifyCard(req.file.path);
  } catch (err) {
    cleanup();
    // Never expose raw error messages from the OpenAI SDK; log server-side only.
    console.error('[scan] identification error:', err.message);
    return res.status(502).json({ error: 'Card identification failed. Please try again.' });
  }

  const imageUrl = `${process.env.PUBLIC_BASE_URL}/uploads/${path.basename(req.file.path)}`;

  try {
    // Upsert into the card catalog. The unique index on
    // (player_name, year, set_name, variant, card_number, sport) ensures exactly
    // one catalog entry per distinct card. DO UPDATE SET sport = sport is a no-op
    // update that satisfies the RETURNING clause on conflict.
    const { rows: cardRows } = await db.query(
      `INSERT INTO cards (player_name, team, position, year, set_name, variant, card_number, sport)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'football')
       ON CONFLICT (player_name, COALESCE(year, 0), COALESCE(set_name, ''),
                   COALESCE(variant, ''), COALESCE(card_number, ''), sport)
       DO UPDATE SET sport = EXCLUDED.sport
       RETURNING *`,
      [
        identification.player_name,
        identification.team,
        identification.position,
        identification.year,
        identification.set_name,
        identification.variant,
        identification.card_number,
      ]
    );
    const card = cardRows[0];

    // Create the collection item for this user.
    const { rows: itemRows } = await db.query(
      `INSERT INTO collection_items
         (user_id, card_id, image_url, condition, raw_identification)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        req.user.id,
        card?.id ?? null,
        imageUrl,
        identification.condition_estimate ?? null,
        JSON.stringify(identification),
      ]
    );
    const item = itemRows[0];

    // Background valuation fetch — does not block the response.
    if (card) {
      upsertValuation(card).catch(err => console.error('[scan] valuation error:', err.message));
    }

    res.status(201).json({ item, card, identification });
  } catch (err) {
    cleanup();
    next(err);
  }
});

// GET /cards/search?q=Patrick+Mahomes&year=2021
router.get('/search', authenticate, async (req, res, next) => {
  try {
    const { q, year, set_name, variant } = req.query;
    const conditions = [];
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      conditions.push(`player_name ILIKE $${params.length}`);
    }
    if (year !== undefined) {
      const y = parseInt(year, 10);
      if (isNaN(y) || y < 1900 || y > 2100) {
        return res.status(400).json({ error: 'year must be a valid 4-digit number' });
      }
      params.push(y);
      conditions.push(`year = $${params.length}`);
    }
    if (set_name) {
      params.push(`%${set_name}%`);
      conditions.push(`set_name ILIKE $${params.length}`);
    }
    if (variant) {
      params.push(`%${variant}%`);
      conditions.push(`variant ILIKE $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT * FROM cards ${where} ORDER BY player_name, year LIMIT 50`,
      params
    );
    res.json({ cards: rows });
  } catch (err) {
    next(err);
  }
});

// GET /cards/:id — card detail + latest valuation
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT c.*,
              v.low_price, v.mid_price, v.high_price, v.sale_count, v.fetched_at AS valuation_at
       FROM cards c
       LEFT JOIN valuations v ON v.card_id = c.id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Card not found' });
    res.json({ card: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
