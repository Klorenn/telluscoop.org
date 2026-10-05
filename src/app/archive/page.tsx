import type { Metadata } from "next";
import ArchiveSearch, { type ArchiveItem } from "@/components/ArchiveSearch";
import { getAllSummaries, getTags } from "@/lib/content";
import { formatDateShort, tagLabel } from "@/lib/site";

export const metadata: Metadata = {
  title: "Archivo",
  description: "Todos los artículos de Tellus Cooperative sobre blockchain, Stellar, IA y Web3 en español. Busca por tema, título o autor.",
  alternates: { canonical: "/archive" },
  openGraph: { title: "Archivo | Tellus Cooperative", url: "/archive" },
  twitter: { title: "Archivo | Tellus Cooperative" },
};

export default function ArchivePage() {
  const items: ArchiveItem[] = getAllSummaries().map((p) => ({
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
  return (
    <div className="mx-auto max-w-[900px] px-5 pt-10 md:px-8 md:pt-16">
      <h1 className="font-display text-[40px] font-extrabold leading-[1.05] tracking-[-0.025em] md:text-[56px]">Archivo</h1>
      <p className="mt-3 max-w-[36rem] font-display text-[19px] leading-[1.5] text-ink-2">
        {items.length} artículos sobre blockchain, Stellar, IA y Web3 en español.
      </p>
      <div className="mt-8">
        <ArchiveSearch items={items} tags={tags} />
      </div>
    </div>
  );
}
