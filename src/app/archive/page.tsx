import type { Metadata } from "next";
import ArchiveSearch from "@/components/ArchiveSearch";
import ShareButtons from "@/components/ShareButtons";
import { getAllSummaries, getTags } from "@/lib/content";
import { absUrl, tagLabel } from "@/lib/site";

export const metadata: Metadata = {
  title: "Archivo",
  description: "Todos los artículos de Tellus Cooperative sobre blockchain, Stellar, IA y Web3 en español. Busca por tema, título o autor.",
  alternates: { canonical: "/archive" },
  openGraph: { title: "Archivo | Tellus Cooperative", url: "/archive" },
  twitter: { title: "Archivo | Tellus Cooperative" },
};

export default function ArchivePage() {
  const posts = getAllSummaries();
  const tags = getTags().map((t) => ({ slug: t.slug, label: tagLabel(t), count: t.count }));
  const shareUrl = absUrl("/archive");

  return (
    <div className="mx-auto max-w-[1280px] px-5 pb-16 pt-10 md:px-8 md:pt-14">
      <div className="grid gap-8 lg:grid-cols-[56px_minmax(0,1fr)] lg:gap-12">
        <aside className="hidden lg:block">
          <div className="sticky top-36">
            <ShareButtons url={shareUrl} title="Boletines Tellus" layout="rail" />
          </div>
        </aside>
        <div className="min-w-0">
          <p className="font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-teal">Archivo</p>
          <h1 className="mt-2 font-display text-[40px] font-bold leading-[1.05] tracking-[-0.03em] md:text-[56px]">
            Boletines Tellus
          </h1>
          <p className="mt-4 max-w-[38rem] font-sans text-[18px] leading-[1.5] text-ink-2">
            Todos los artículos sobre blockchain, Stellar, IA y Web3 en español. {posts.length} publicaciones para
            buscar, filtrar y seguir leyendo.
          </p>
          <div className="mt-5 lg:hidden">
            <ShareButtons url={shareUrl} title="Boletines Tellus" />
          </div>
          <div className="mt-8">
            <ArchiveSearch posts={posts} tags={tags} />
          </div>
        </div>
      </div>
    </div>
  );
}
