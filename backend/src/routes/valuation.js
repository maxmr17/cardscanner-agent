const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { upsertValuation } = require('../services/valuation');

const router = express.Router();

// GET /valuation/:cardId — return cached valuation; refresh if stale (> 24 h).
router.get('/:cardId', authenticate, async (req, res, next) => {
  try {
    const { rows: cardRows } = await db.query('SELECT * FROM cards WHERE id = $1', [req.params.cardId]);
    if (!cardRows.length) return res.status(404).json({ error: 'Card not found' });
    const card = cardRows[0];

    const { rows: valuationRows } = await db.query(
      'SELECT * FROM valuations WHERE card_id = $1',
      [card.id]
    );

    const existing = valuationRows[0];
    const staleCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    if (existing && new Date(existing.fetched_at) > staleCutoff) {
      return res.json({ valuation: existing, card });
    }

    // Refresh and upsert — then return the fresh row.
    await upsertValuation(card);
    const { rows: fresh } = await db.query('SELECT * FROM valuations WHERE card_id = $1', [card.id]);
    res.json({ valuation: fresh[0] ?? null, card });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
