import Image from "next/image";
import Link from "next/link";
import type { PostSummary } from "@/lib/content/types";
import { formatDateShort, tagLabel } from "@/lib/site";

export function Meta({ post, className = "" }: { post: PostSummary; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-[13px] text-teal-deep ${className}`}>
      {post.authors[0] && <span className="font-medium text-ink-2">{post.authors[0].name}</span>}
      {post.authors[0] && <span aria-hidden="true">·</span>}
      <time dateTime={post.publishedAt} className="font-mono text-[12px] uppercase tracking-tight">
        {formatDateShort(post.publishedAt)}
      </time>
      {post.readingMinutes ? (
        <>
          <span aria-hidden="true">·</span>
          <span>{post.readingMinutes} min</span>
        </>
      ) : null}
    </div>
  );
}

export function TagPill({ tag }: { tag: { slug: string; name: string } }) {
  return (
    <Link
      prefetch={false}
      href={`/t/${tag.slug}`}
      className="relative z-10 inline-block font-sans text-[12px] font-semibold uppercase tracking-wider text-teal hover:text-teal-deep"
    >
      {tagLabel(tag)}
    </Link>
  );
}

/** Tarjeta vertical (grillas Milk Road). */
export function PostCard({
  post,
  priority = false,
  sizes = "(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw",
}: {
  post: PostSummary;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <article className="group relative flex flex-col">
      {post.image && (
        <div className="relative aspect-[16/10] overflow-hidden rounded-[20px] bg-sand-soft">
          <Image
            src={post.image.url}
            alt=""
            fill
            sizes={sizes}
            priority={priority}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </div>
      )}
      <div className="mt-4 flex flex-col gap-2">
        {post.tags[0] && <TagPill tag={post.tags[0]} />}
        <h3 className="line-clamp-3 font-display text-[21px] font-bold leading-[1.25] tracking-[-0.015em] text-ink">
          <Link prefetch={false} href={`/p/${post.slug}`} className="after:absolute after:inset-0 group-hover:text-teal-deep">
            {post.title}
          </Link>
        </h3>
        <p className="line-clamp-2 min-h-[3rem] font-sans text-[16px] leading-[1.5] text-ink-2">{post.subtitle || post.excerpt}</p>
        <Meta post={post} className="mt-1" />
      </div>
    </article>
  );
}

/** Fila (listas "Lo último", archivo). compact = sin bajada y miniatura chica. */
export function PostRow({ post, compact = false }: { post: PostSummary; compact?: boolean }) {
  return (
    <article className={`group relative flex gap-4 ${compact ? "py-4" : "py-5 sm:gap-6"}`}>
      <div className="min-w-0 flex-1">
        {post.tags[0] && <TagPill tag={post.tags[0]} />}
        <h3 className={`mt-1 font-display font-bold leading-[1.3] text-ink ${compact ? "text-[18px]" : "text-[19px] sm:text-[21px]"}`}>
          <Link prefetch={false} href={`/p/${post.slug}`} className="after:absolute after:inset-0 group-hover:text-teal-deep">
            {post.title}
          </Link>
        </h3>
        {!compact && (
          <p className="mt-1.5 line-clamp-2 hidden font-sans text-[16px] leading-[1.5] text-ink-2 sm:block">{post.subtitle || post.excerpt}</p>
        )}
        <Meta post={post} className="mt-2" />
      </div>
      {post.image && (
        <div
          className={`relative shrink-0 self-start overflow-hidden rounded-[14px] bg-sand-soft ${
            compact ? "aspect-square w-20 sm:w-24" : "aspect-[4/3] w-24 sm:aspect-[16/10] sm:w-52"
          }`}
        >
          <Image src={post.image.url} alt="" fill sizes={compact ? "96px" : "(min-width: 640px) 208px, 96px"} className="object-cover" />
        </div>
      )}
    </article>
  );
}
