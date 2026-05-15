const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 12;

// A pre-hashed dummy value used when the email isn't found so that bcrypt.compare
// still runs, equalizing response time and preventing email-enumeration via timing.
const DUMMY_HASH = '$2b$12$X4kv7j5ZcG39WgogSl16aufSB3jMRMecPPaGYcuHpJKoFBSbJ/7.y';

function issueToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
}

// POST /auth/signup
router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, username, display_name } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ error: 'email, password, and username are required' });
    }
    if (typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return res.status(400).json({ error: 'Username must be 3–30 alphanumeric characters or underscores' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const { rows } = await db.query(
      `INSERT INTO users (email, password_hash, username, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, username, display_name, avatar_url, created_at`,
      [email.toLowerCase().trim(), password_hash, username.toLowerCase(), display_name?.trim() || username]
    );

    const user = rows[0];
    res.status(201).json({ token: issueToken(user.id), user });
  } catch (err) {
    if (err.code === '23505') {
      const field = err.constraint?.includes('email') ? 'email' : 'username';
      return res.status(409).json({ error: `That ${field} is already in use` });
    }
    next(err);
  }
});

// POST /auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const { rows } = await db.query(
      'SELECT id, email, password_hash, username, display_name, avatar_url FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    const user = rows[0];
    // Always run bcrypt.compare — even when the user doesn't exist — so that response
    // time is identical regardless of whether the email is registered. This prevents
    // email enumeration via timing differences.
    const hashToCheck = user?.password_hash ?? DUMMY_HASH;
    const match = await bcrypt.compare(password, hashToCheck);

    if (!match || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const { password_hash: _, ...safeUser } = user;
    res.json({ token: issueToken(user.id), user: safeUser });
  } catch (err) {
    next(err);
  }
});

// GET /auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// PATCH /auth/profile
router.patch('/profile', authenticate, async (req, res, next) => {
  try {
    const { display_name, bio, is_public } = req.body;
    const { rows } = await db.query(
      `UPDATE users SET display_name = COALESCE($1, display_name),
                         bio         = COALESCE($2, bio),
                         is_public   = COALESCE($3, is_public)
       WHERE id = $4
       RETURNING id, email, username, display_name, avatar_url, bio, is_public`,
      [display_name, bio, is_public, req.user.id]
    );
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
