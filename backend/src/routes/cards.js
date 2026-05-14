// Card scanning and identification routes
const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { identifyCard } = require('../services/cardIdentification');
const { fetchEbayPrices } = require('../services/valuation');

const router = express.Router();

// POST /cards/scan
// Accepts a card image, identifies it via GPT-4o, persists to DB.
router.post('/scan', authenticate, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

  let identification;
  try {
    identification = await identifyCard(req.file.path);
  } catch (err) {
    fs.unlinkSync(req.file.path);
    return res.status(502).json({ error: 'Card identification failed', detail: err.message });
  }

  // Upsert card into master catalog
  const { rows: cardRows } = await db.query(
    `INSERT INTO cards (player_name, team, position, year, set_name, variant, card_number, sport)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'football')
     ON CONFLICT DO NOTHING
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

  let card = cardRows[0];
  if (!card) {
    // Card already exists — look it up
    const existing = await db.query(
      `SELECT * FROM cards WHERE player_name = $1 AND year = $2 AND set_name = $3 AND variant IS NOT DISTINCT FROM $4`,
      [identification.player_name, identification.year, identification.set_name, identification.variant]
    );
    card = existing.rows[0];
  }

  // Build public image URL
  const imageUrl = `${process.env.PUBLIC_BASE_URL}/uploads/${path.basename(req.file.path)}`;

  // Create collection item
  const { rows: itemRows } = await db.query(
    `INSERT INTO collection_items
       (user_id, card_id, image_url, condition, raw_identification)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      req.user.id,
      card?.id || null,
      imageUrl,
      identification.condition_estimate || null,
      JSON.stringify(identification),
    ]
  );

  const item = itemRows[0];

  // Background: fetch valuation and cache it (don't block the response)
  if (card) {
    fetchEbayPrices(card).then(async (pricing) => {
      if (pricing) {
        await db.query(
          `INSERT INTO valuations (card_id, low_price, mid_price, high_price, sale_count)
           VALUES ($1, $2, $3, $4, $5)`,
          [card.id, pricing.low_price, pricing.mid_price, pricing.high_price, pricing.sale_count]
        );
      }
    }).catch(() => {});
  }

  res.status(201).json({ item, card, identification });
});

// GET /cards/search?q=Patrick+Mahomes&year=2021
router.get('/search', authenticate, async (req, res) => {
  const { q, year, set_name, variant } = req.query;
  const conditions = [];
  const params = [];

  if (q) {
    params.push(`%${q}%`);
    conditions.push(`player_name ILIKE $${params.length}`);
  }
  if (year) {
    params.push(parseInt(year));
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
  const { rows } = await db.query(`SELECT * FROM cards ${where} ORDER BY player_name, year LIMIT 50`, params);
  res.json({ cards: rows });
});

// GET /cards/:id — card detail + latest valuation
router.get('/:id', authenticate, async (req, res) => {
  const { rows } = await db.query(
    `SELECT c.*,
            v.low_price, v.mid_price, v.high_price, v.sale_count, v.fetched_at AS valuation_at
     FROM cards c
     LEFT JOIN LATERAL (
       SELECT * FROM valuations WHERE card_id = c.id ORDER BY fetched_at DESC LIMIT 1
     ) v ON TRUE
     WHERE c.id = $1`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Card not found' });
  res.json({ card: rows[0] });
});

module.exports = router;
