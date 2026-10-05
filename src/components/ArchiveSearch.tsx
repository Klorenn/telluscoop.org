"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export interface ArchiveItem {
  s: string; // slug
  t: string; // título
  x: string; // subtítulo
  d: string; // fecha ISO
  f: string; // fecha formateada
  g: string[]; // slugs de tags
  a: string; // autor
  i?: string; // imagen
}

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const PAGE = 24;

export default function ArchiveSearch({ items, tags }: { items: ArchiveItem[]; tags: { slug: string; label: string; count: number }[] }) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (sp.get("q")) setQ(sp.get("q") || "");
    if (sp.get("tag")) setTag(sp.get("tag"));
  }, []);

  const index = useMemo(() => items.map((it) => ({ it, hay: fold(`${it.t} ${it.x} ${it.a} ${it.g.join(" ")}`) })), [items]);
  const results = useMemo(() => {
    const words = fold(q).split(/\s+/).filter(Boolean);
    return index.filter(({ it, hay }) => (!tag || it.g.includes(tag)) && words.every((w) => hay.includes(w))).map((r) => r.it);
  }, [index, q, tag]);

  const labelOf = (slug: string) => tags.find((t) => t.slug === slug)?.label || slug;

  return (
    <div>
      <div className="sticky top-16 z-20 -mx-5 border-b border-line bg-white/95 px-5 pb-4 pt-3 backdrop-blur md:top-[72px] md:mx-0 md:px-0">
        <label htmlFor="buscar" className="sr-only">Buscar artículos</label>
        <div className="relative">
          <svg className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-muted" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            id="buscar"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Busca: Soroban, hackathon, IA…"
            className="h-14 w-full rounded-full border border-line bg-white pl-14 pr-5 font-sans text-[17px] outline-none focus:border-teal"
          />
        </div>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setTag(null)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 font-sans text-[13px] font-medium ${!tag ? "bg-ink text-white" : "bg-cream text-ink-2 hover:bg-mint"}`}
          >
            Todo ({items.length})
          </button>
          {tags.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => {
                setTag(tag === t.slug ? null : t.slug);
                setLimit(PAGE);
              }}
              className={`shrink-0 rounded-full px-3.5 py-1.5 font-sans text-[13px] font-medium ${tag === t.slug ? "bg-ink text-white" : "bg-cream text-ink-2 hover:bg-mint"}`}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>
      </div>

      <p className="mt-6 font-sans text-[14px] text-muted" aria-live="polite">
        {results.length === items.length ? `${items.length} artículos` : `${results.length} resultado${results.length === 1 ? "" : "s"}`}
      </p>

      {results.length === 0 ? (
        <div className="py-16 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mascot-planets.webp" alt="" width={240} height={200} className="mx-auto h-28 w-auto" />
          <p className="mt-4 font-display text-[22px] font-bold">No encontramos artículos con “{q}”.</p>
          <p className="mt-2 font-sans text-muted">Prueba con otra palabra o quita el filtro de categoría.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {results.slice(0, limit).map((it) => (
            <li key={it.s} className="group relative flex gap-4 py-5 sm:gap-6">
              <div className="min-w-0 flex-1">
                {it.g[0] && <span className="font-sans text-[12px] font-semibold uppercase tracking-wider text-teal">{labelOf(it.g[0])}</span>}
                <h2 className="mt-1 font-display text-[19px] font-bold leading-[1.3] text-ink sm:text-[22px]">
                  <Link prefetch={false} href={`/p/${it.s}`} className="after:absolute after:inset-0 group-hover:text-teal-dark">
                    {it.t}
                  </Link>
                </h2>
                <p className="mt-1.5 line-clamp-2 hidden font-display text-[16px] leading-[1.5] text-ink-2 sm:block">{it.x}</p>
                <div className="mt-2 flex gap-2 font-sans text-[13px] text-muted">
                  {it.a && <span className="font-medium text-ink-2">{it.a}</span>}
                  {it.a && <span aria-hidden="true">·</span>}
                  <time dateTime={it.d} className="font-mono text-[12px] uppercase">{it.f}</time>
                </div>
              </div>
              {it.i && (
                <div className="relative aspect-[4/3] w-24 shrink-0 self-start overflow-hidden rounded-xl bg-cream sm:aspect-[2/1] sm:w-52">
                  <Image src={it.i} alt="" fill sizes="(min-width: 640px) 208px, 96px" className="object-cover" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {results.length > limit && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="rounded-full border border-ink px-6 py-3 font-sans text-[15px] font-semibold hover:bg-ink hover:text-white"
          >
            Cargar más ({results.length - limit} restantes)
          </button>
        </div>
      )}
    </div>
  );
}
