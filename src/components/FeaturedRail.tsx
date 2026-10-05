import Image from "next/image";
import Link from "next/link";
import type { PostSummary } from "@/lib/content/types";

export default function FeaturedRail({ posts }: { posts: PostSummary[] }) {
  if (posts.length === 0) return null;
  return (
    <div className="space-y-10">
      {posts.map((p, i) => (
        <article key={p.slug} className="group">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            {i === 0 ? "Destacado" : "También te puede gustar"}
          </p>
          {p.image && (
            <Link prefetch={false} href={`/p/${p.slug}`} className="mt-3 block overflow-hidden rounded-[16px] bg-cream">
              <span className="relative block aspect-[16/10]">
                <Image src={p.image.url} alt="" fill sizes="280px" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
              </span>
            </Link>
          )}
          <h3 className="mt-3 font-display text-[18px] font-bold leading-snug tracking-[-0.015em]">
            <Link prefetch={false} href={`/p/${p.slug}`} className="hover:text-teal-dark">
              {p.title}
            </Link>
          </h3>
          <p className="mt-2 line-clamp-3 font-display text-[14px] leading-[1.5] text-ink-2">{p.subtitle || p.excerpt}</p>
          <Link
            prefetch={false}
            href={`/p/${p.slug}`}
            className="mt-4 inline-flex rounded-full border border-line px-4 py-2 font-sans text-[13px] font-semibold text-ink hover:border-ink"
          >
            Ver más
          </Link>
        </article>
      ))}
    </div>
  );
}
