// eBay Browse API valuation service
// Docs: https://developer.ebay.com/api-docs/buy/browse/overview.html

const https = require('https');
const db = require('../config/database');

let cachedToken = null;
let tokenExpiry = 0;

async function getEbayToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const credentials = Buffer.from(
    `${process.env.EBAY_APP_ID}:${process.env.EBAY_CLIENT_SECRET}`
  ).toString('base64');

  const body = 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope';

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.ebay.com',
      path: '/identity/v1/oauth2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (!json.access_token) return reject(new Error(`eBay token error: ${data.slice(0, 200)}`));
          cachedToken = json.access_token;
          tokenExpiry = Date.now() + (json.expires_in ?? 7200) * 1000 - 60_000;
          resolve(cachedToken);
        } catch (err) {
          reject(new Error(`eBay token parse failed: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10_000, () => { req.destroy(); reject(new Error('eBay token request timed out')); });
    req.write(body);
    req.end();
  });
}

function buildSearchQuery(card) {
  const parts = [card.player_name];
  if (card.year)    parts.push(card.year);
  if (card.set_name) parts.push(card.set_name);
  if (card.variant && card.variant !== 'Base') parts.push(card.variant);
  return parts.join(' ');
}

// Proper median: average of two middle values for even-length arrays.
function median(sorted) {
  const n = sorted.length;
  if (n === 0) return null;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

async function fetchEbayPrices(card) {
  if (!process.env.EBAY_APP_ID || !process.env.EBAY_CLIENT_SECRET) return null;

  const token = await getEbayToken();
  const query = encodeURIComponent(buildSearchQuery(card));

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.ebay.com',
      // Sports Trading Cards category (214). No condition filter — graded and raw
      // cards use different eBay condition buckets, so filtering would exclude results.
      path: `/buy/browse/v1/item_summary/search?q=${query}&category_ids=214&limit=20`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const items = json.itemSummaries || [];
          if (!items.length) return resolve(null);

          const prices = items
            .map(item => parseFloat(item.price?.value))
            .filter(p => !isNaN(p) && p > 0)
            .sort((a, b) => a - b);

          if (!prices.length) return resolve(null);

          resolve({
            low_price:  prices[0],
            mid_price:  median(prices),
            high_price: prices[prices.length - 1],
            sale_count: prices.length,
          });
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(15_000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// Upsert valuation: one row per card, updated in-place.
// The valuations table has a UNIQUE constraint on card_id so old data is
// replaced rather than accumulated.
async function upsertValuation(card) {
  const pricing = await fetchEbayPrices(card);
  if (!pricing) return;

  await db.query(
    `INSERT INTO valuations (card_id, low_price, mid_price, high_price, sale_count, fetched_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (card_id) DO UPDATE
       SET low_price  = EXCLUDED.low_price,
           mid_price  = EXCLUDED.mid_price,
           high_price = EXCLUDED.high_price,
           sale_count = EXCLUDED.sale_count,
           fetched_at = NOW()`,
    [card.id, pricing.low_price, pricing.mid_price, pricing.high_price, pricing.sale_count]
  );
}

module.exports = { fetchEbayPrices, upsertValuation };
