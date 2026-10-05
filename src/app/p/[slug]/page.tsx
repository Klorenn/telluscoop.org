import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import ShareButtons from "@/components/ShareButtons";
import ArticleBody from "@/components/ArticleBody";
import StickySubscribe from "@/components/StickySubscribe";
import SubscribeCard from "@/components/SubscribeCard";
import FeaturedRail from "@/components/FeaturedRail";
import HubBanner from "@/components/HubBanner";
import Illustration, { TAG_ILLUSTRATIONS } from "@/components/Illustration";
import { PostCard, TagPill } from "@/components/PostCard";
import { getAllPosts, getPost, getPostBySourceSlug, getRelated } from "@/lib/content";
import { absUrl, formatDate, SITE, tagLabel } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  const url = `/p/${post.slug}`;
  const images = post.image ? [{ url: post.image.url, width: post.image.width, height: post.image.height, alt: post.title }] : undefined;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: url },
    authors: post.authors.map((a) => ({ name: a.name })),
    keywords: post.tags.map((t) => tagLabel(t)),
    openGraph: {
      type: "article",
      url,
      title: post.title,
      description: post.description,
      siteName: SITE.name,
      locale: SITE.locale,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: post.authors.map((a) => a.name),
      tags: post.tags.map((t) => tagLabel(t)),
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: post.image ? [post.image.url] : undefined,
      creator: post.authors[0]?.twitter ? `@${post.authors[0].twitter}` : undefined,
    },
  };
}

export default async function PostPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) {
    const old = getPostBySourceSlug(slug);
    if (old) permanentRedirect(`/p/${old.slug}`);
    notFound();
  }
  const url = absUrl(`/p/${post.slug}`);
  const related = getRelated(post, 4);
  const author = post.authors[0];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    inLanguage: "es",
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    mainEntityOfPage: url,
    image: post.image?.url,
    author: post.authors.map((a) => ({ "@type": "Person", name: a.name })),
    publisher: { "@type": "Organization", name: SITE.name, logo: { "@type": "ImageObject", url: absUrl("/brand/logo-color.png") } },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="mx-auto max-w-[1280px] px-5 pt-8 md:px-8 md:pt-12">
        <div className="grid gap-10 lg:grid-cols-[56px_minmax(0,720px)_280px] lg:justify-center lg:gap-12">
          <aside className="hidden lg:block">
            <div className="sticky top-36">
              <ShareButtons url={url} title={post.title} layout="rail" />
            </div>
          </aside>

          <div className="min-w-0">
            <h1 className="font-display text-[34px] font-bold leading-[1.08] tracking-[-0.03em] text-ink sm:text-[44px] md:text-[52px]">
              {post.title}
            </h1>
            {post.subtitle && (
              <p className="mt-5 font-sans text-[19px] leading-[1.55] text-ink-2 md:text-[22px]">{post.subtitle}</p>
            )}

            <div className="mt-7">
              <HubBanner compact />
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                {post.tags[0] && TAG_ILLUSTRATIONS[post.tags[0].slug] ? (
                  <Illustration
                    name={TAG_ILLUSTRATIONS[post.tags[0].slug]}
                    className="h-11 w-11 rounded-full object-cover"
                  />
                ) : null}
                <div>
                  {post.tags[0] && <TagPill tag={post.tags[0]} />}
                  <p className="mt-2 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-teal-deep">Escrito por</p>
                  <div className="mt-2 flex items-center gap-3">
                    {author?.avatar && (
                      <Image src={author.avatar} alt="" width={44} height={44} className="h-11 w-11 rounded-full bg-sand-soft object-cover" />
                    )}
                    <div className="font-sans text-[14px] leading-tight">
                      <div className="font-semibold text-ink">{post.authors.map((a) => a.name).join(", ") || "Tellus Cooperative"}</div>
                      <div className="mt-1 text-teal-deep">
                        <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                        {post.readingMinutes ? <> · {post.readingMinutes} min de lectura</> : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:hidden">
                <ShareButtons url={url} title={post.title} />
              </div>
            </div>

            {post.image && (
              <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-[14px] bg-sand-soft ring-1 ring-line">
                <Image src={post.image.url} alt={post.title} fill priority sizes="(min-width: 800px) 720px, 100vw" className="object-cover" />
              </div>
            )}

            <div className="mt-10">
              <ArticleBody html={post.html} />
            </div>

            {post.tags.length > 0 && (
              <div className="mt-10 flex flex-wrap gap-2">
                {post.tags.map((t) => (
                  <Link key={t.slug} href={`/t/${t.slug}`} className="rounded-full bg-sand-soft px-3.5 py-1.5 font-sans text-[13px] font-medium text-ink-2 hover:bg-sand-muted">
                    #{tagLabel(t)}
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-10">
              <SubscribeCard placement="end" title="¿Te gustó? Recibe el próximo en tu correo" />
            </div>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-36 space-y-10">
              {post.toc.length > 1 && (
                <nav aria-label="En este artículo">
                  <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-teal-deep">En esta página</p>
                  <ol className="mt-3 space-y-2">
                    {post.toc.slice(0, 12).map((i) => (
                      <li key={i.id} className={i.level === 3 ? "pl-3" : ""}>
                        <a href={`#${i.id}`} className="font-sans text-[14px] leading-snug text-ink-2 hover:text-teal">
                          {i.text}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              )}
              <FeaturedRail posts={related.slice(0, 2)} />
            </div>
          </aside>
        </div>
      </article>

      {related.length > 0 && (
        <section className="mx-auto mt-16 max-w-[1280px] px-5 md:px-8">
          <div className="mb-7 flex items-end justify-between">
            <div>
              <p className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-teal-deep">Sigue leyendo</p>
              <h2 className="mt-1 font-display text-[28px] font-bold tracking-[-0.02em]">Más de Tellus</h2>
            </div>
            {post.tags[0] && <TagPill tag={post.tags[0]} />}
          </div>
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {related.slice(0, 3).map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        </section>
      )}

      <StickySubscribe />
    </>
  );
}
