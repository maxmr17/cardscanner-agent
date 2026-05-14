// Market valuation routes
const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { fetchEbayPrices } = require('../services/valuation');

const router = express.Router();

// GET /valuation/:cardId — fetch cached valuation, refresh if stale (>24h)
router.get('/:cardId', authenticate, async (req, res) => {
  const { rows: cardRows } = await db.query('SELECT * FROM cards WHERE id = $1', [req.params.cardId]);
  if (!cardRows.length) return res.status(404).json({ error: 'Card not found' });
  const card = cardRows[0];

  const { rows: valuationRows } = await db.query(
    'SELECT * FROM valuations WHERE card_id = $1 ORDER BY fetched_at DESC LIMIT 1',
    [card.id]
  );

  const existing = valuationRows[0];
  const staleCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  if (existing && new Date(existing.fetched_at) > staleCutoff) {
    return res.json({ valuation: existing, card });
  }

  // Refresh
  const pricing = await fetchEbayPrices(card);
  if (!pricing) {
    return res.json({ valuation: existing || null, card, message: 'No market data found' });
  }

  const { rows } = await db.query(
    `INSERT INTO valuations (card_id, low_price, mid_price, high_price, sale_count)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [card.id, pricing.low_price, pricing.mid_price, pricing.high_price, pricing.sale_count]
  );

  res.json({ valuation: rows[0], card });
});

module.exports = router;
