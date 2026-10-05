import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import ShareButtons from "@/components/ShareButtons";
import SubscribeForm from "@/components/SubscribeForm";
import ArticleBody from "@/components/ArticleBody";
import StickySubscribe from "@/components/StickySubscribe";
import { PostCard, TagPill } from "@/components/PostCard";
import { getAllPosts, getPost, getPostBySourceSlug, getRelated } from "@/lib/content";
import { absUrl, formatDate, SITE, tagLabel } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  // Solo slugs limpios. Los slugs viejos con acentos rotos se resuelven con 301 en next.config.ts
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
  const related = getRelated(post, 3);
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
    publisher: { "@type": "Organization", name: SITE.name, logo: { "@type": "ImageObject", url: absUrl("/brand/tellus-logo.png") } },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="mx-auto max-w-[1200px] px-5 md:px-8">
        <header className="mx-auto max-w-[760px] pt-10 md:pt-16">
          <nav aria-label="Ruta" className="flex flex-wrap items-center gap-2 font-sans text-[13px] text-muted">
            <Link href="/" className="hover:text-teal">Inicio</Link>
            {post.tags[0] && (
              <>
                <span aria-hidden="true">/</span>
                <Link href={`/t/${post.tags[0].slug}`} className="hover:text-teal">{tagLabel(post.tags[0])}</Link>
              </>
            )}
          </nav>
          <h1 className="mt-5 font-display text-[34px] font-extrabold leading-[1.08] tracking-[-0.025em] text-ink sm:text-[44px] md:text-[52px]">
            {post.title}
          </h1>
          {post.subtitle && (
            <p className="mt-5 font-display text-[19px] leading-[1.55] text-ink-2 md:text-[22px]">{post.subtitle}</p>
          )}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-5 border-y border-line py-4">
            <div className="flex items-center gap-3">
              {author?.avatar && (
                <Image src={author.avatar} alt="" width={44} height={44} className="h-11 w-11 rounded-full bg-cream object-cover" />
              )}
              <div className="font-sans text-[14px] leading-tight">
                <div className="font-semibold text-ink">{post.authors.map((a) => a.name).join(", ") || "Tellus Cooperative"}</div>
                <div className="mt-1 text-muted">
                  <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                  {post.readingMinutes ? <> · {post.readingMinutes} min de lectura</> : null}
                </div>
              </div>
            </div>
            <ShareButtons url={url} title={post.title} />
          </div>
        </header>

        {post.image && (
          <div className="relative mx-auto mt-8 aspect-[2/1] max-w-[1000px] overflow-hidden rounded-3xl bg-cream ring-1 ring-line md:mt-10">
            <Image src={post.image.url} alt={post.title} fill priority sizes="(min-width: 1064px) 1000px, 100vw" className="object-cover" />
          </div>
        )}

        <div className="mx-auto mt-10 grid max-w-[1100px] gap-12 md:mt-14 lg:grid-cols-[minmax(0,700px)_260px] lg:justify-center lg:gap-16">
          <div className="min-w-0">
            <ArticleBody html={post.html} />

            {post.tags.length > 0 && (
              <div className="mx-auto mt-12 flex max-w-[700px] flex-wrap gap-2">
                {post.tags.map((t) => (
                  <Link key={t.slug} href={`/t/${t.slug}`} className="rounded-full bg-cream px-3.5 py-1.5 font-sans text-[13px] font-medium text-ink-2 hover:bg-mint">
                    #{tagLabel(t)}
                  </Link>
                ))}
              </div>
            )}

            <div className="mx-auto mt-8 max-w-[700px] border-t border-line pt-6">
              <p className="mb-3 font-sans text-[13px] font-semibold uppercase tracking-wider text-muted">Comparte este artículo</p>
              <ShareButtons url={url} title={post.title} />
            </div>

            {/* CTA newsletter al final */}
            <aside className="mx-auto mt-12 max-w-[700px] rounded-3xl bg-mint p-7 md:p-10" aria-labelledby="cta-title">
              <h2 id="cta-title" className="font-display text-[26px] font-extrabold leading-[1.15] tracking-[-0.015em] md:text-[30px]">
                ¿Te gustó? Recibe el próximo en tu correo
              </h2>
              <p className="mt-2 font-display text-[17px] leading-[1.5] text-ink-2">
                Noticias crypto y Web3 en español, directo a tu correo. Gratis, cada semana.
              </p>
              <div className="mt-5">
                <SubscribeForm placement="end" source="end" />
              </div>
            </aside>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-10">
              {post.toc.length > 1 && (
                <nav aria-label="En este artículo">
                  <p className="font-sans text-[12px] font-semibold uppercase tracking-wider text-muted">En este artículo</p>
                  <ol className="mt-3 space-y-2 border-l border-line">
                    {post.toc.slice(0, 14).map((i) => (
                      <li key={i.id} className={i.level === 3 ? "pl-7" : "pl-4"}>
                        <a href={`#${i.id}`} className="-ml-px block border-l-2 border-transparent pl-0 font-sans text-[14px] leading-snug text-ink-2 hover:text-teal">
                          {i.text}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              )}
              {related.length > 0 && (
                <div>
                  <p className="font-sans text-[12px] font-semibold uppercase tracking-wider text-muted">Relacionados</p>
                  <ul className="mt-3 space-y-4">
                    {related.map((r) => (
                      <li key={r.slug}>
                        <Link prefetch={false} href={`/p/${r.slug}`} className="font-display text-[16px] font-bold leading-snug text-ink hover:text-teal-dark">
                          {r.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </aside>
        </div>
      </article>

      {related.length > 0 && (
        <section className="mx-auto mt-20 max-w-[1200px] px-5 md:px-8">
          <div className="mb-7 flex items-baseline justify-between border-b-2 border-ink pb-3">
            <h2 className="font-display text-[26px] font-extrabold tracking-[-0.015em]">Sigue leyendo</h2>
            {post.tags[0] && <TagPill tag={post.tags[0]} />}
          </div>
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        </section>
      )}

      <StickySubscribe />
    </>
  );
}
