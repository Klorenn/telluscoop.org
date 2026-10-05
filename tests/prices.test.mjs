import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import {
  COINGECKO_PRICE_URL,
  TICKER_COINS,
  TICKER_REVALIDATE_SECONDS,
  formatChange,
  formatUsd,
  lastTickerQuotes,
  parseCoinGeckoPayload,
  resetTickerQuotes,
  resolveTickerQuotes,
} from "../src/lib/ticker.mjs";

const root = new URL("../", import.meta.url);
const read = (rel) => readFile(new URL(rel, root), "utf8");

const sample = {
  bitcoin: { usd: 64000.4, usd_24h_change: 1.234 },
  ethereum: { usd: 3421.5, usd_24h_change: -0.42 },
  stellar: { usd: 0.1234, usd_24h_change: 0 },
  solana: { usd: 142.3, usd_24h_change: 3.01 },
  "usd-coin": { usd: 1.0, usd_24h_change: 0.01 },
};

test("prices route caches CoinGecko, sends demo key, and never throws", async () => {
  const src = await read("src/app/api/prices/route.ts");
  const ticker = await read("src/components/PriceTicker.tsx");
  const header = await read("src/components/Header.tsx");
  assert.ok(existsSync(new URL("src/app/api/prices/route.ts", root)));
  assert.match(src, /COINGECKO_API_KEY/);
  assert.match(src, /x-cg-demo-api-key/);
  assert.match(src, /revalidate/);
  assert.match(src, /lastTickerQuotes/);
  assert.match(src, /ok: false, prices: \[\]/);
  assert.match(src, /status: 200/);
  assert.doesNotMatch(src, /status: 500/);
  assert.equal(TICKER_REVALIDATE_SECONDS, 90);
  assert.ok(TICKER_REVALIDATE_SECONDS >= 60 && TICKER_REVALIDATE_SECONDS <= 120);
  assert.match(COINGECKO_PRICE_URL, /api\.coingecko\.com\/api\/v3\/simple\/price/);
  assert.match(COINGECKO_PRICE_URL, /bitcoin,ethereum,stellar,solana,usd-coin/);
  assert.match(COINGECKO_PRICE_URL, /include_24hr_change=true/);
  assert.deepEqual(
    TICKER_COINS.map((c) => c.symbol),
    ["BTC", "ETH", "XLM", "SOL", "USDC"],
  );
  assert.match(ticker, /Precios por CoinGecko/);
  assert.match(ticker, /coingecko\.com/);
  assert.match(header, /PriceTicker/);
});

test("ticker parse and last-good fallback hide nothing when cache exists", () => {
  resetTickerQuotes();
  assert.equal(parseCoinGeckoPayload(null), null);
  assert.equal(parseCoinGeckoPayload({ bitcoin: { usd: 1 } }), null);
  assert.equal(lastTickerQuotes(), null);
  assert.equal(resolveTickerQuotes({ nope: true }), null);

  const first = resolveTickerQuotes(sample);
  assert.equal(first?.length, 5);
  assert.equal(first?.[0].symbol, "BTC");
  assert.equal(first?.[2].symbol, "XLM");
  assert.equal(lastTickerQuotes()?.length, 5);

  const stale = resolveTickerQuotes({ bitcoin: { usd: "nope" } });
  assert.equal(stale, first);
  assert.equal(lastTickerQuotes(), first);

  resetTickerQuotes();
  assert.equal(resolveTickerQuotes(undefined), null);
});

test("ticker formats USD and muted percent change", () => {
  assert.equal(formatUsd(64000.4), "$64,000");
  assert.equal(formatUsd(3421.5), "$3,421.50");
  assert.equal(formatUsd(0.1234), "$0.1234");
  assert.equal(formatUsd(1), "$1.00");
  assert.equal(formatChange(1.234), "+1.23%");
  assert.equal(formatChange(-0.4), "−0.40%");
  assert.equal(formatChange(0), "0.00%");
});
