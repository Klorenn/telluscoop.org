"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PostCard, Meta, TagPill } from "@/components/PostCard";
import Character from "@/components/Character";
import SubscribeCard from "@/components/SubscribeCard";
import type { PostSummary } from "@/lib/content/types";

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const PAGE = 12;

export default function ArchiveSearch({
  posts,
  tags,
}: {
  posts: PostSummary[];
  tags: { slug: string; label: string; count: number }[];
}) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("q")) setQ(sp.get("q") || "");
    if (sp.get("tag")) setTag(sp.get("tag"));
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (tag) sp.set("tag", tag);
    const qs = sp.toString();
    const next = qs ? `/archive?${qs}` : "/archive";
    if (`${window.location.pathname}${window.location.search}` !== next) {
      window.history.replaceState(null, "", next);
    }
  }, [q, tag]);

  const index = useMemo(
    () =>
      posts.map((p) => ({
        p,
        hay: fold(`${p.title} ${p.subtitle} ${p.excerpt} ${p.authors.map((a) => a.name).join(" ")} ${p.tags.map((t) => t.name).join(" ")}`),
      })),
    [posts],
  );

  const results = useMemo(() => {
    const words = fold(q).split(/\s+/).filter(Boolean);
    return index.filter(({ p, hay }) => (!tag || p.tags.some((t) => t.slug === tag)) && words.every((w) => hay.includes(w))).map((r) => r.p);
  }, [index, q, tag]);

  const withThumbs = results.filter((p) => p.image?.url);
  const browsing = !q && !tag;
  const featured = browsing ? withThumbs[0] : undefined;
  const rest = featured ? withThumbs.filter((p) => p.slug !== featured.slug) : withThumbs;
  const shown = rest.slice(0, limit);

  return (
    <div>
      <div className="sticky top-[112px] z-20 -mx-5 border-b border-line bg-sand/95 px-5 py-4 backdrop-blur lg:top-[76px] md:mx-0 md:px-0">
        <label htmlFor="buscar" className="sr-only">
          Buscar artículos
        </label>
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-ink-2"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
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
            placeholder="Busca un artículo, tema o autor"
            className="h-14 w-full rounded-full border border-line bg-sand pl-14 pr-5 font-sans text-[17px] text-ink outline-none placeholder:text-muted focus:border-ink"
          />
        </div>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => {
              setTag(null);
              setLimit(PAGE);
            }}
            className={`shrink-0 rounded-full px-3.5 py-1.5 font-sans text-[13px] font-medium ${!tag ? "bg-ink text-sand" : "bg-sand-soft text-ink-2 hover:bg-sand-muted"}`}
          >
            Todos <span className="opacity-70">{posts.length}</span>
          </button>
          {tags.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => {
                setTag(tag === t.slug ? null : t.slug);
                setLimit(PAGE);
              }}
              className={`shrink-0 rounded-full px-3.5 py-1.5 font-sans text-[13px] font-medium ${tag === t.slug ? "bg-ink text-sand" : "bg-sand-soft text-ink-2 hover:bg-sand-muted"}`}
            >
              {t.label} <span className="opacity-70">{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-6 font-sans text-[14px] text-muted" aria-live="polite">
        {results.length} {results.length === 1 ? "artículo" : "artículos"}
        {tag || q ? " encontrados" : ""}
      </p>

      {results.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Character name="emprendimiento" className="h-40 w-48 object-contain object-bottom" />
          <p className="mt-4 font-display text-[24px] font-bold tracking-[-0.02em]">Nada por aquí todavía</p>
          <p className="mt-2 max-w-md font-sans text-[16px] text-ink-2">
            No encontramos artículos{q ? ` con “${q}”` : ""}
            {tag ? " en esta categoría" : ""}. Prueba otra búsqueda o mira todos los boletines.
          </p>
          <button
            type="button"
            onClick={() => {
              setQ("");
              setTag(null);
              setLimit(PAGE);
            }}
            className="cta-pill mt-6 h-11 px-5 text-[14px] text-ink"
          >
            Ver todos
          </button>
        </div>
      ) : (
        <>
          {featured && (
            <article className="group relative mt-8 grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-12">
              <div className="relative aspect-[16/9] overflow-hidden rounded-[20px] bg-sand-soft lg:aspect-[16/10]">
                <Image
                  src={featured.image!.url}
                  alt=""
                  fill
                  priority
                  sizes="(min-width: 1024px) 720px, 100vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </div>
              <div className="flex flex-col justify-center">
                <p className="font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-teal">Lo último</p>
                {featured.tags[0] && (
                  <div className="mt-2">
                    <TagPill tag={featured.tags[0]} />
                  </div>
                )}
                <h2 className="mt-2 font-display text-[28px] font-bold leading-[1.12] tracking-[-0.025em] md:text-[36px]">
                  <Link prefetch={false} href={`/p/${featured.slug}`} className="after:absolute after:inset-0 group-hover:text-teal-dark">
                    {featured.title}
                  </Link>
                </h2>
                <p className="mt-3 line-clamp-3 max-w-[36rem] font-sans text-[18px] leading-[1.5] text-ink-2">{featured.subtitle || featured.excerpt}</p>
                <Meta post={featured} className="mt-4" />
              </div>
            </article>
          )}

          <div className={`grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 ${featured ? "mt-12" : "mt-8"}`}>
            {shown.map((p, i) => (
              <PostCard key={p.slug} post={p} priority={i < 3} />
            ))}
          </div>

          {rest.length > limit && (
            <div className="mt-12 text-center">
              <button
                type="button"
                onClick={() => setLimit((l) => l + PAGE)}
                className="rounded-full border border-ink px-6 py-3 font-sans text-[15px] font-semibold text-ink hover:bg-ink hover:text-sand"
              >
                Cargar más
              </button>
            </div>
          )}

          <div className="mt-16">
            <SubscribeCard placement="archive" title="El boletín de Tellus, cada semana en tu correo" />
          </div>
        </>
      )}
    </div>
  );
}
