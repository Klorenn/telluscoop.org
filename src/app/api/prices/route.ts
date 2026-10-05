/**
 * GET /api/prices
 * Cached CoinGecko quotes for the blog ticker. Never throws to the client:
 * a failed upstream fetch returns the last good payload, or an empty list.
 */
import { NextResponse } from "next/server";
import { COINGECKO_PRICE_URL, lastTickerQuotes, resolveTickerQuotes } from "@/lib/ticker.mjs";

export const revalidate = 90;

function json(body: unknown, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status: 200,
    headers: {
      "Cache-Control": "public, s-maxage=90, stale-while-revalidate=300",
      ...extraHeaders,
    },
  });
}

export async function GET() {
  const headers: Record<string, string> = { Accept: "application/json" };
  const demoKey = process.env.COINGECKO_API_KEY;
  if (demoKey) headers["x-cg-demo-api-key"] = demoKey;

  try {
    const res = await fetch(COINGECKO_PRICE_URL, {
      headers,
      next: { revalidate: 90 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data: unknown = await res.json();
    const prices = resolveTickerQuotes(data);
    if (!prices) return json({ ok: false, prices: [] });
    return json({ ok: true, prices });
  } catch {
    const cached = lastTickerQuotes();
    if (cached) return json({ ok: true, prices: cached, stale: true });
    return json({ ok: false, prices: [] }, { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" });
  }
}
