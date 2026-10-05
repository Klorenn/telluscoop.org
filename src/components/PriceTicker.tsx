"use client";

import { useEffect, useState } from "react";
import { formatChange, formatUsd } from "@/lib/ticker.mjs";
import type { TickerQuote } from "@/lib/ticker-types";

type Payload = { ok?: boolean; prices?: TickerQuote[] };

function Quote({ q }: { q: TickerQuote }) {
  const up = q.change24h > 0;
  const down = q.change24h < 0;
  const tone = up ? "text-tick-up" : down ? "text-tick-down" : "text-teal-deep";
  return (
    <span className="inline-flex shrink-0 items-baseline gap-2 font-mono text-[12px] tracking-[0.02em] text-ink">
      <span className="font-semibold uppercase">{q.symbol}</span>
      <span>{formatUsd(q.usd)}</span>
      <span className={tone}>{formatChange(q.change24h)}</span>
    </span>
  );
}

function Row({ prices }: { prices: TickerQuote[] }) {
  return (
    <>
      {prices.map((q) => (
        <Quote key={q.symbol} q={q} />
      ))}
    </>
  );
}

export default function PriceTicker() {
  const [prices, setPrices] = useState<TickerQuote[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/prices", { cache: "no-store" });
        const data = (await res.json()) as Payload;
        if (cancelled) return;
        if (data?.ok && Array.isArray(data.prices) && data.prices.length > 0) {
          setPrices(data.prices);
        } else {
          setPrices((prev) => prev);
        }
      } catch {
        /* keep last rendered row, or stay hidden */
      }
    };
    load();
    const id = window.setInterval(load, 90_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (!prices || prices.length === 0) return null;

  return (
    <div className="border-b border-line bg-sand-soft" data-ticker="coingecko">
      <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-4 py-2 md:px-8">
        <div className="ticker-mask min-w-0 flex-1">
          <div className="ticker-track md:justify-center md:gap-8">
            <div className="flex items-center gap-6 md:gap-8">
              <Row prices={prices} />
            </div>
            <div className="flex items-center gap-6 md:hidden" aria-hidden="true">
              <Row prices={prices} />
            </div>
          </div>
        </div>
        <a
          href="https://www.coingecko.com"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-teal-deep hover:text-teal sm:text-[10px]"
        >
          <span className="sm:hidden">CoinGecko</span>
          <span className="hidden sm:inline">Precios por CoinGecko</span>
        </a>
      </div>
      <p className="sr-only">Precios por CoinGecko</p>
    </div>
  );
}
