// Collection management routes
const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /collection — current user's collection
router.get('/', authenticate, async (req, res) => {
  const { page = 1, limit = 30, sort = 'newest', player, year, set_name } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const orderMap = {
    newest:    'ci.created_at DESC',
    oldest:    'ci.created_at ASC',
    player:    'c.player_name ASC',
    value_asc: 'v.mid_price ASC NULLS LAST',
    value_desc:'v.mid_price DESC NULLS LAST',
  };
  const order = orderMap[sort] || orderMap.newest;

  const filters = ['ci.user_id = $1'];
  const params = [req.user.id];

  if (player) {
    params.push(`%${player}%`);
    filters.push(`c.player_name ILIKE $${params.length}`);
  }
  if (year) {
    params.push(parseInt(year));
    filters.push(`c.year = $${params.length}`);
  }
  if (set_name) {
    params.push(`%${set_name}%`);
    filters.push(`c.set_name ILIKE $${params.length}`);
  }

  const where = filters.join(' AND ');

  const countResult = await db.query(
    `SELECT COUNT(*) FROM collection_items ci LEFT JOIN cards c ON ci.card_id = c.id WHERE ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  params.push(parseInt(limit), offset);
  const { rows } = await db.query(
    `SELECT ci.*, c.player_name, c.team, c.position, c.year, c.set_name, c.variant, c.card_number,
            v.low_price, v.mid_price, v.high_price
     FROM collection_items ci
     LEFT JOIN cards c ON ci.card_id = c.id
     LEFT JOIN LATERAL (
       SELECT low_price, mid_price, high_price
       FROM valuations WHERE card_id = ci.card_id ORDER BY fetched_at DESC LIMIT 1
     ) v ON TRUE
     WHERE ${where}
     ORDER BY ${order}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  res.json({ items: rows, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
});

// GET /collection/:userId — another user's public collection
router.get('/:userId', authenticate, async (req, res) => {
  const { rows: users } = await db.query(
    'SELECT id, username, display_name, avatar_url, bio, is_public FROM users WHERE id = $1',
    [req.params.userId]
  );
  if (!users.length) return res.status(404).json({ error: 'User not found' });

  const owner = users[0];
  if (!owner.is_public && owner.id !== req.user.id) {
    return res.status(403).json({ error: 'This collection is private' });
  }

  const { rows } = await db.query(
    `SELECT ci.id, ci.image_url, ci.condition, ci.created_at,
            c.player_name, c.team, c.year, c.set_name, c.variant,
            v.mid_price
     FROM collection_items ci
     LEFT JOIN cards c ON ci.card_id = c.id
     LEFT JOIN LATERAL (
       SELECT mid_price FROM valuations WHERE card_id = ci.card_id ORDER BY fetched_at DESC LIMIT 1
     ) v ON TRUE
     WHERE ci.user_id = $1
     ORDER BY ci.created_at DESC
     LIMIT 100`,
    [owner.id]
  );

  res.json({ owner, items: rows });
});

// PATCH /collection/items/:id — update condition, notes, pricing, for_sale flag
router.patch('/items/:id', authenticate, async (req, res) => {
  const { condition, notes, acquired_date, purchase_price, for_sale, asking_price } = req.body;

  const { rows } = await db.query(
    `UPDATE collection_items
     SET condition      = COALESCE($1, condition),
         notes          = COALESCE($2, notes),
         acquired_date  = COALESCE($3, acquired_date),
         purchase_price = COALESCE($4, purchase_price),
         for_sale       = COALESCE($5, for_sale),
         asking_price   = COALESCE($6, asking_price)
     WHERE id = $7 AND user_id = $8
     RETURNING *`,
    [condition, notes, acquired_date, purchase_price, for_sale, asking_price, req.params.id, req.user.id]
  );

  if (!rows.length) return res.status(404).json({ error: 'Item not found or not yours' });
  res.json({ item: rows[0] });
});

// DELETE /collection/items/:id
router.delete('/items/:id', authenticate, async (req, res) => {
  const { rowCount } = await db.query(
    'DELETE FROM collection_items WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Item not found or not yours' });
  res.status(204).send();
});

// GET /collection/stats/summary — portfolio value, card count, etc.
router.get('/stats/summary', authenticate, async (req, res) => {
  const { rows } = await db.query(
    `SELECT
       COUNT(ci.id)::int                  AS total_cards,
       SUM(v.mid_price)                   AS portfolio_value,
       SUM(ci.purchase_price)             AS total_cost,
       COUNT(DISTINCT c.player_name)::int AS unique_players,
       COUNT(DISTINCT c.year)::int        AS years_represented
     FROM collection_items ci
     LEFT JOIN cards c ON ci.card_id = c.id
     LEFT JOIN LATERAL (
       SELECT mid_price FROM valuations WHERE card_id = ci.card_id ORDER BY fetched_at DESC LIMIT 1
     ) v ON TRUE
     WHERE ci.user_id = $1`,
    [req.user.id]
  );
  res.json({ stats: rows[0] });
});

module.exports = router;
