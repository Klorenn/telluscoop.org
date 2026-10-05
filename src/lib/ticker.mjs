/** CoinGecko ticker helpers — shared by the API route and tests. */

export const TICKER_COINS = [
  { id: "bitcoin", symbol: "BTC" },
  { id: "ethereum", symbol: "ETH" },
  { id: "stellar", symbol: "XLM" },
  { id: "solana", symbol: "SOL" },
  { id: "usd-coin", symbol: "USDC" },
];

export const COINGECKO_PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,stellar,solana,usd-coin&vs_currencies=usd&include_24hr_change=true";

export const TICKER_REVALIDATE_SECONDS = 90;

/** @type {import("./ticker-types").TickerQuote[] | null} */
let lastGood = null;

/**
 * @param {unknown} data
 * @returns {import("./ticker-types").TickerQuote[] | null}
 */
export function parseCoinGeckoPayload(data) {
  if (!data || typeof data !== "object") return null;
  const quotes = [];
  for (const coin of TICKER_COINS) {
    const row = /** @type {Record<string, { usd?: unknown; usd_24h_change?: unknown }>} */ (data)[coin.id];
    const usd = Number(row?.usd);
    const change = Number(row?.usd_24h_change);
    if (!Number.isFinite(usd)) return null;
    quotes.push({
      id: coin.id,
      symbol: coin.symbol,
      usd,
      change24h: Number.isFinite(change) ? change : 0,
    });
  }
  return quotes;
}

export function lastTickerQuotes() {
  return lastGood;
}

export function resetTickerQuotes() {
  lastGood = null;
}

/**
 * Remember a successful payload, or return the last good one if parsing fails.
 * @param {unknown} fresh
 * @returns {import("./ticker-types").TickerQuote[] | null}
 */
export function resolveTickerQuotes(fresh) {
  const parsed = parseCoinGeckoPayload(fresh);
  if (parsed) {
    lastGood = parsed;
    return parsed;
  }
  return lastGood;
}

/** @param {number} n */
export function formatUsd(n) {
  if (n >= 10000) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  }
  if (n >= 1) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(n);
}

/** @param {number} n */
export function formatChange(n) {
  const abs = Math.abs(n).toFixed(2);
  if (n > 0) return `+${abs}%`;
  if (n < 0) return `−${abs}%`;
  return `${abs}%`;
}
