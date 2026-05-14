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

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve uploaded card images
app.use('/uploads', express.static(process.env.STORAGE_PATH || path.join(__dirname, '../uploads')));

// Rate limiting
app.use('/cards/scan', rateLimit({ windowMs: 60_000, max: 30, message: { error: 'Too many scans. Try again shortly.' } }));
app.use('/auth', rateLimit({ windowMs: 15 * 60_000, max: 20 }));

app.use('/auth',       authRoutes);
app.use('/cards',      cardsRoutes);
app.use('/collection', collectionRoutes);
app.use('/social',     socialRoutes);
app.use('/valuation',  valuationRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Global error handler
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CardScanner API running on :${PORT}`));
