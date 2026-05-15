const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ── IMPORTANT: specific routes BEFORE parameterized /:userId ──────────────────

// GET /social/users/search?q=username
// Must be registered BEFORE /users/:userId or Express matches userId='search'.
router.get('/users/search', authenticate, async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'q must be at least 2 characters' });
    }
    const { rows } = await db.query(
      `SELECT id, username, display_name, avatar_url FROM users
       WHERE username ILIKE $1 OR display_name ILIKE $1
       LIMIT 20`,
      [`%${q.trim()}%`]
    );
    res.json({ users: rows });
  } catch (err) {
    next(err);
  }
});

// GET /social/users/:userId — profile + follow stats
router.get('/users/:userId', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, u.is_public, u.created_at,
              (SELECT COUNT(*) FROM follows WHERE following_id = u.id)::int AS follower_count,
              (SELECT COUNT(*) FROM follows WHERE follower_id  = u.id)::int AS following_count,
              (SELECT COUNT(*) FROM collection_items WHERE user_id = u.id)::int AS card_count,
              EXISTS (SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id) AS is_following
       FROM users u WHERE u.id = $2`,
      [req.user.id, req.params.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ profile: rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── Feed ─────────────────────────────────────────────────────────────────────

router.get('/feed', authenticate, async (req, res, next) => {
  try {
    const rawPage  = parseInt(req.query.page, 10);
    const rawLimit = parseInt(req.query.limit, 10);
    const page  = Number.isFinite(rawPage)  && rawPage  > 0 ? rawPage  : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 20;
    const offset = (page - 1) * limit;

    const { rows } = await db.query(
      `SELECT p.id, p.caption, p.created_at,
              u.id AS author_id, u.username, u.display_name, u.avatar_url,
              ci.image_url, ci.condition,
              c.player_name, c.team, c.year, c.set_name, c.variant,
              v.mid_price,
              COUNT(DISTINCT l.user_id)::int AS like_count,
              COUNT(DISTINCT cm.id)::int     AS comment_count,
              EXISTS (SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $1) AS liked_by_me
       FROM posts p
       JOIN users u ON p.user_id = u.id
       JOIN collection_items ci ON p.collection_item_id = ci.id
       LEFT JOIN cards c ON ci.card_id = c.id
       LEFT JOIN valuations v ON v.card_id = ci.card_id
       LEFT JOIN likes l ON l.post_id = p.id
       LEFT JOIN comments cm ON cm.post_id = p.id
       WHERE p.user_id = $1
          OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1)
       GROUP BY p.id, u.id, ci.id, c.id, v.mid_price, v.low_price, v.high_price
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    res.json({ posts: rows, page, has_more: rows.length === limit });
  } catch (err) {
    next(err);
  }
});

// ─── Posts ────────────────────────────────────────────────────────────────────

router.post('/posts', authenticate, async (req, res, next) => {
  try {
    const { collection_item_id, caption } = req.body;
    if (!collection_item_id) return res.status(400).json({ error: 'collection_item_id is required' });

    const { rows: items } = await db.query(
      'SELECT id FROM collection_items WHERE id = $1 AND user_id = $2',
      [collection_item_id, req.user.id]
    );
    if (!items.length) return res.status(403).json({ error: 'Collection item not found or not yours' });

    const { rows } = await db.query(
      'INSERT INTO posts (user_id, collection_item_id, caption) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, collection_item_id, caption?.trim() || null]
    );
    res.status(201).json({ post: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/posts/:id', authenticate, async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      'DELETE FROM posts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Post not found or not yours' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/posts/:id', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT p.*, u.username, u.display_name, u.avatar_url,
              ci.image_url, ci.condition,
              c.player_name, c.team, c.year, c.set_name, c.variant,
              COUNT(DISTINCT l.user_id)::int AS like_count,
              EXISTS (SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $2) AS liked_by_me
       FROM posts p
       JOIN users u ON p.user_id = u.id
       JOIN collection_items ci ON p.collection_item_id = ci.id
       LEFT JOIN cards c ON ci.card_id = c.id
       LEFT JOIN likes l ON l.post_id = p.id
       WHERE p.id = $1
       GROUP BY p.id, u.id, ci.id, c.id`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Post not found' });
    res.json({ post: rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── Likes ────────────────────────────────────────────────────────────────────

router.post('/posts/:id/like', authenticate, async (req, res, next) => {
  try {
    // Verify the post exists before inserting the like (avoids FK error as control flow).
    const { rows } = await db.query('SELECT id FROM posts WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Post not found' });

    await db.query(
      'INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.id, req.params.id]
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.delete('/posts/:id/like', authenticate, async (req, res, next) => {
  try {
    await db.query('DELETE FROM likes WHERE user_id = $1 AND post_id = $2', [req.user.id, req.params.id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── Comments ─────────────────────────────────────────────────────────────────

router.get('/posts/:id/comments', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT cm.id, cm.content, cm.created_at, u.id AS user_id, u.username, u.display_name, u.avatar_url
       FROM comments cm JOIN users u ON cm.user_id = u.id
       WHERE cm.post_id = $1 ORDER BY cm.created_at ASC`,
      [req.params.id]
    );
    res.json({ comments: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/posts/:id/comments', authenticate, async (req, res, next) => {
  try {
    const content = req.body.content?.trim();
    if (!content) return res.status(400).json({ error: 'content is required' });

    // Verify post exists.
    const { rows: posts } = await db.query('SELECT id FROM posts WHERE id = $1', [req.params.id]);
    if (!posts.length) return res.status(404).json({ error: 'Post not found' });

    const { rows } = await db.query(
      'INSERT INTO comments (user_id, post_id, content) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, req.params.id, content]
    );
    res.status(201).json({ comment: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.delete('/comments/:id', authenticate, async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      'DELETE FROM comments WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Comment not found or not yours' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── Follows ──────────────────────────────────────────────────────────────────

router.post('/follow/:userId', authenticate, async (req, res, next) => {
  try {
    if (req.params.userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }
    const { rows } = await db.query('SELECT id FROM users WHERE id = $1', [req.params.userId]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    await db.query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.id, req.params.userId]
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.delete('/follow/:userId', authenticate, async (req, res, next) => {
  try {
    await db.query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [req.user.id, req.params.userId]
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
