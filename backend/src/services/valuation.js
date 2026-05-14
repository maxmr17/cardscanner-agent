// eBay Browse API valuation service
// Searches recently completed eBay listings to derive market price estimates.
// Docs: https://developer.ebay.com/api-docs/buy/browse/overview.html

const https = require('https');

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
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const json = JSON.parse(data);
        cachedToken = json.access_token;
        tokenExpiry = Date.now() + json.expires_in * 1000 - 60000;
        resolve(cachedToken);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function buildSearchQuery(card) {
  const parts = [card.player_name];
  if (card.year) parts.push(card.year);
  if (card.set_name) parts.push(card.set_name);
  if (card.variant && card.variant !== 'Base') parts.push(card.variant);
  return parts.join(' ');
}

async function fetchEbayPrices(card) {
  if (!process.env.EBAY_APP_ID || !process.env.EBAY_CLIENT_SECRET) {
    return null; // eBay not configured
  }

  const token = await getEbayToken();
  const query = encodeURIComponent(buildSearchQuery(card));

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.ebay.com',
      // filter=buyingOptions:{AUCTION|FIXED_PRICE} and soldItems equivalent via Marketplace Insights
      path: `/buy/browse/v1/item_summary/search?q=${query}&category_ids=214&filter=conditions:{USED|LIKE_NEW|VERY_GOOD|GOOD|ACCEPTABLE}&limit=20`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const items = json.itemSummaries || [];

          if (!items.length) return resolve(null);

          const prices = items
            .map((item) => parseFloat(item.price?.value))
            .filter((p) => !isNaN(p) && p > 0)
            .sort((a, b) => a - b);

          if (!prices.length) return resolve(null);

          const low  = prices[0];
          const high = prices[prices.length - 1];
          const mid  = prices[Math.floor(prices.length / 2)];

          resolve({ low_price: low, mid_price: mid, high_price: high, sale_count: prices.length });
        } catch (err) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

module.exports = { fetchEbayPrices };
