import Image from "next/image";
import Link from "next/link";
import SubscribeForm from "@/components/SubscribeForm";
import { Meta, PostCard, PostRow, TagPill } from "@/components/PostCard";
import { getAllSummaries, getPostsByTag, getTags } from "@/lib/content";
import { HOME_ROWS, SITE, tagLabel } from "@/lib/site";

export default function Home() {
  const posts = getAllSummaries();
  const [featured, ...rest] = posts;
  const latest = rest.slice(0, 6);
  const shown = new Set([featured.slug, ...latest.map((p) => p.slug)]);
  const tags = getTags();
  const rows = HOME_ROWS.map((slug) => tags.find((t) => t.slug === slug))
    .filter((t): t is NonNullable<typeof t> => !!t)
    .map((tag) => {
      const items = getPostsByTag(tag.slug).filter((p) => !shown.has(p.slug)).slice(0, 3);
      items.forEach((p) => shown.add(p.slug));
      return { tag, items };
    })
    .filter((r) => r.items.length >= 2);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.url,
    inLanguage: "es",
    publisher: { "@type": "Organization", name: SITE.name, logo: `${SITE.url}/brand/tellus-logo.png` },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* HERO */}
      <section id="suscribete" className="relative overflow-hidden border-b border-line">
        <div className="mx-auto grid max-w-[1200px] items-center gap-8 px-5 pb-12 pt-12 md:grid-cols-[1.15fr_1fr] md:px-8 md:pb-20 md:pt-20">
          <div className="relative z-10">
            <h1 className="font-display text-[42px] font-extrabold leading-[1.02] tracking-[-0.03em] text-ink sm:text-[56px] lg:text-[68px]">
              Transforma tu curiosidad en proyectos reales
            </h1>
            <p className="mt-6 max-w-[34rem] font-display text-[19px] leading-[1.55] text-ink-2 md:text-[21px]">
              Noticias, cursos y herramientas para entender blockchain, Stellar y Web3. Todo en español, directo a tu correo.
            </p>
            <p className="mt-8 font-sans text-[13px] font-semibold uppercase tracking-[0.08em] text-ink">
              Únete a 5.000+ personas que aprenden blockchain
            </p>
            <div className="mt-3 max-w-[33rem]">
              <SubscribeForm placement="hero" source="hero" size="lg" />
            </div>
          </div>
          <div className="relative -mx-5 -mb-12 h-[280px] sm:h-[360px] md:mx-0 md:-mb-20 md:h-[500px]">
            <div className="tellus-blob absolute bottom-0 left-[14%] right-[-40%] top-[10%] md:left-[10%] md:right-[-30%]" aria-hidden="true" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/mascot-planets.webp"
              alt="Las mascotas de Tellus: dos planetas Tierra con botas amarillas y un megáfono"
              width={960}
              height={776}
              fetchPriority="high"
              className="absolute bottom-3 left-1/2 h-[94%] w-auto max-w-none -translate-x-1/2 object-contain md:bottom-6 md:left-[55%]"
            />
          </div>
        </div>
      </section>

      {/* DESTACADO + LO ÚLTIMO */}
      <section className="mx-auto max-w-[1200px] px-5 pt-14 md:px-8 md:pt-20">
        <div className="grid gap-12 lg:grid-cols-[1.45fr_1fr] lg:gap-14">
          <article className="group relative">
            <p className="mb-4 font-sans text-[13px] font-semibold uppercase tracking-[0.08em] text-clay">Destacado</p>
            {featured.image && (
              <div className="relative aspect-[2/1] overflow-hidden rounded-3xl bg-cream">
                <Image src={featured.image.url} alt="" fill priority sizes="(min-width: 1024px) 680px, 100vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
              </div>
            )}
            <div className="mt-6">
              {featured.tags[0] && <TagPill tag={featured.tags[0]} />}
              <h2 className="mt-2 font-display text-[30px] font-extrabold leading-[1.12] tracking-[-0.02em] text-ink md:text-[40px]">
                <Link prefetch={false} href={`/p/${featured.slug}`} className="after:absolute after:inset-0 group-hover:text-teal-dark">
                  {featured.title}
                </Link>
              </h2>
              <p className="mt-3 max-w-[40rem] font-display text-[18px] leading-[1.55] text-ink-2 md:text-[19px]">{featured.subtitle}</p>
              <Meta post={featured} className="mt-4" />
            </div>
          </article>
          <div>
            <div className="mb-1 flex items-baseline justify-between border-b-2 border-ink pb-3">
              <h2 className="font-display text-[22px] font-extrabold tracking-[-0.01em]">Lo último</h2>
              <Link href="/archive" className="font-sans text-[14px] font-semibold text-teal hover:text-teal-dark">
                Ver todo →
              </Link>
            </div>
            <div className="divide-y divide-line">
              {latest.map((p) => (
                <PostRow key={p.slug} post={p} compact />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FILAS POR CATEGORÍA */}
      {rows.map(({ tag, items }, i) => (
        <section key={tag.slug} className="mx-auto max-w-[1200px] px-5 pt-16 md:px-8 md:pt-20">
          <div className="mb-7 flex items-baseline justify-between border-b-2 border-ink pb-3">
            <h2 className="font-display text-[26px] font-extrabold tracking-[-0.015em] md:text-[30px]">{tagLabel(tag)}</h2>
            <Link href={`/t/${tag.slug}`} className="font-sans text-[14px] font-semibold text-teal hover:text-teal-dark">
              Ver todo ({tag.count}) →
            </Link>
          </div>
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p, j) => (
              <div key={p.slug} className={j === 2 ? "hidden lg:block" : ""}>
                <PostCard post={p} />
              </div>
            ))}
          </div>
          {i === 1 && (
            <div className="mt-16 grid items-center gap-6 rounded-3xl bg-mint px-6 py-10 md:mt-20 md:grid-cols-[1.1fr_1fr] md:px-12 md:py-12">
              <div>
                <h2 className="font-display text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em] md:text-[34px]">
                  El boletín de Tellus, cada semana en tu correo
                </h2>
                <p className="mt-3 font-display text-[18px] leading-[1.5] text-ink-2">
                  Oportunidades, guías y lo más importante de Stellar y Web3 en LATAM, en 5 minutos.
                </p>
              </div>
              <SubscribeForm placement="band" source="band" />
            </div>
          )}
        </section>
      ))}
    </>
  );
}
