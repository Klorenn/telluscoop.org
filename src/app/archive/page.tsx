import type { Metadata } from "next";
import ArchiveSearch, { type ArchiveItem } from "@/components/ArchiveSearch";
import SubscribeCard from "@/components/SubscribeCard";
import FeaturedRail from "@/components/FeaturedRail";
import ShareButtons from "@/components/ShareButtons";
import { getAllSummaries, getTags } from "@/lib/content";
import { absUrl, formatDateShort, tagLabel } from "@/lib/site";

export const metadata: Metadata = {
  title: "Archivo",
  description: "Todos los artículos de Tellus Cooperative sobre blockchain, Stellar, IA y Web3 en español. Busca por tema, título o autor.",
  alternates: { canonical: "/archive" },
  openGraph: { title: "Archivo | Tellus Cooperative", url: "/archive" },
  twitter: { title: "Archivo | Tellus Cooperative" },
};

export default function ArchivePage() {
  const summaries = getAllSummaries();
  const items: ArchiveItem[] = summaries.map((p) => ({
    s: p.slug,
    t: p.title,
    x: (p.subtitle || p.excerpt).slice(0, 180),
    d: p.publishedAt,
    f: formatDateShort(p.publishedAt),
    g: p.tags.map((t) => t.slug),
    a: p.authors[0]?.name || "",
    i: p.image?.url,
  }));
  const tags = getTags().map((t) => ({ slug: t.slug, label: tagLabel(t), count: t.count }));
  const featured = summaries.slice(0, 2);
  const shareUrl = absUrl("/archive");

  return (
    <div className="mx-auto max-w-[1280px] px-5 pt-8 md:px-8 md:pt-12">
      <div className="grid gap-10 lg:grid-cols-[56px_minmax(0,760px)_280px] lg:justify-center lg:gap-12">
        <aside className="hidden lg:block">
          <div className="sticky top-36">
            <ShareButtons url={shareUrl} title="Boletines Tellus" layout="rail" />
          </div>
        </aside>
        <div className="min-w-0">
          <p className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-teal-deep">Archivo</p>
          <h1 className="mt-2 font-display text-[40px] font-bold leading-[1.05] tracking-[-0.03em] md:text-[52px]">Boletines Tellus</h1>
          <div className="mt-6">
            <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-teal-deep">Escrito por</p>
            <p className="mt-2 font-sans text-[15px] font-semibold text-ink">Tellus Cooperative</p>
            <p className="font-sans text-[13px] text-teal-deep">{items.length} artículos · Equipo editorial</p>
          </div>
          <div className="mt-8">
            <SubscribeCard placement="archive" title="Aprende blockchain en español, cinco minutos a la semana." body="" />
          </div>
          <div className="mt-10">
            <ArchiveSearch items={items} tags={tags} />
          </div>
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-36">
            <FeaturedRail posts={featured} />
          </div>
        </aside>
      </div>
    </div>
  );
}
