require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes       = require('./routes/auth');
const cardsRoutes      = require('./routes/cards');
const collectionRoutes = require('./routes/collection');
const socialRoutes     = require('./routes/social');
const valuationRoutes  = require('./routes/valuation');

const app = express();

// Security headers
app.use(helmet());

// CORS: allow only origins explicitly listed in the environment.
// In development, set ALLOWED_ORIGINS=http://localhost:3001,http://localhost:8081
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    cb(new Error(`Origin ${origin} not allowed`));
  },
  credentials: true,
}));

// Body parsers with explicit size caps to prevent memory exhaustion.
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// Serve uploaded card images. In production, move this behind a CDN or S3.
app.use('/uploads', express.static(process.env.STORAGE_PATH || path.join(__dirname, '../uploads')));

// Rate limiting — per-IP for auth endpoints, per-IP for scan (user-level enforcement
// happens inside the route after JWT validation).
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth requests, try again later.' },
});
const scanLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many scans. Try again shortly.' },
});

app.use('/auth', authLimiter);
app.use('/cards/scan', scanLimiter);

app.use('/auth',       authRoutes);
app.use('/cards',      cardsRoutes);
app.use('/collection', collectionRoutes);
app.use('/social',     socialRoutes);
app.use('/valuation',  valuationRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Global error handler — never expose stack traces in production.
app.use((err, req, res, _next) => {
  const isDev = process.env.NODE_ENV !== 'production';
  console.error(`[${req.method} ${req.path}]`, err.message);
  if (isDev) console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CardScanner API running on :${PORT}`));
