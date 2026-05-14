const jwt = require('jsonwebtoken');
const db = require('../config/database');

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { rows } = await db.query(
    'SELECT id, email, username, display_name, avatar_url, is_public FROM users WHERE id = $1',
    [payload.sub]
  );
  if (!rows.length) return res.status(401).json({ error: 'User not found' });

  req.user = rows[0];
  next();
}

module.exports = { authenticate };
