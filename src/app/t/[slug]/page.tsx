import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/PostCard";
import SubscribeCard from "@/components/SubscribeCard";
import { getPostsByTag, getTags } from "@/lib/content";
import { tagLabel } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return getTags().map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/t/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tag = getTags().find((t) => t.slug === slug);
  if (!tag) return {};
  const title = tagLabel(tag);
  const description = `Artículos de Tellus Cooperative sobre ${title.toLowerCase()}: ${tag.count} publicaciones en español.`;
  return {
    title,
    description,
    alternates: { canonical: `/t/${slug}` },
    openGraph: { title: `${title} | Tellus Cooperative`, description, url: `/t/${slug}` },
    twitter: { title: `${title} | Tellus Cooperative`, description },
  };
}

export default async function TagPage({ params }: PageProps<"/t/[slug]">) {
  const { slug } = await params;
  const tag = getTags().find((t) => t.slug === slug);
  if (!tag) notFound();
  const posts = getPostsByTag(slug);
  const others = getTags().filter((t) => t.slug !== slug);
  return (
    <div className="mx-auto max-w-[1280px] px-5 pt-10 md:px-8 md:pt-14">
      <p className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-teal-deep">Categoría</p>
      <h1 className="mt-2 font-display text-[40px] font-bold leading-[1.05] tracking-[-0.03em] md:text-[56px]">{tagLabel(tag)}</h1>
      <p className="mt-3 font-sans text-[19px] text-ink-2">{posts.length} artículos</p>
      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1">
        <Link href="/archive" className="shrink-0 rounded-full bg-sand-soft px-3.5 py-1.5 font-sans text-[13px] font-medium text-ink-2 hover:bg-sand-muted">
          Todos
        </Link>
        {others.map((t) => (
          <Link key={t.slug} href={`/t/${t.slug}`} className="shrink-0 rounded-full bg-sand-soft px-3.5 py-1.5 font-sans text-[13px] font-medium text-ink-2 hover:bg-sand-muted">
            {tagLabel(t)}
          </Link>
        ))}
      </div>
      <div className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p, i) => (
          <PostCard key={p.slug} post={p} priority={i < 3} />
        ))}
      </div>
      <div className="mt-16">
        <SubscribeCard placement={`tag-${slug}`} title={`Recibe lo nuevo de ${tagLabel(tag)} en tu correo`} />
      </div>
    </div>
  );
}
