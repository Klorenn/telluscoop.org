import Image from "next/image";
import Link from "next/link";
import SubscribeForm from "@/components/SubscribeForm";
import SubscribeCard from "@/components/SubscribeCard";
import Logo from "@/components/Logo";
import { Meta, PostCard, TagPill } from "@/components/PostCard";
import { getAllSummaries, getPostsByTag, getTags } from "@/lib/content";
import { HOME_ROWS, SITE, tagLabel } from "@/lib/site";

export default function Home() {
  const posts = getAllSummaries();
  const [featured, ...rest] = posts;
  const latest = rest.slice(0, 5);
  const shown = new Set([featured?.slug, ...latest.map((p) => p.slug)].filter(Boolean));
  const tags = getTags();
  const chips = HOME_ROWS.map((slug) => tags.find((t) => t.slug === slug)).filter((t): t is NonNullable<typeof t> => !!t);
  const rows = chips
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
    publisher: { "@type": "Organization", name: SITE.name, logo: `${SITE.url}/brand/logo-color.png` },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section id="suscribete" className="border-b border-line">
        <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-5 py-12 md:px-8 md:py-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:gap-16 lg:py-20">
          <div className="max-w-[38rem]">
            <p className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-teal-deep">Boletín semanal</p>
            <h1 className="mt-4 font-display text-[42px] font-bold leading-[0.98] tracking-[-0.035em] text-ink sm:text-[56px] lg:text-[68px]">
              Convierte
              <br />
              <em>curiosidad</em>
              <br />
              en proyectos reales
            </h1>
            <p className="mt-6 max-w-[32rem] font-sans text-[17px] leading-[1.55] text-ink-2 md:text-[19px]">
              Noticias, cursos y herramientas para entender blockchain, Stellar y Web3. Todo en español, directo a tu correo.
            </p>
            <div className="mt-8 max-w-[34rem]">
              <SubscribeForm placement="hero" source="hero" size="lg" />
            </div>
          </div>
          <div className="relative mx-auto hidden w-full max-w-[420px] lg:block" aria-hidden="true">
            <div className="relative grid aspect-square place-items-center overflow-hidden rounded-[14px] border border-line bg-sand-soft">
              <span className="absolute left-8 top-8 h-3 w-3 rounded-full bg-clay" />
              <span className="absolute right-10 top-16 h-2 w-2 rounded-full bg-teal" />
              <span className="absolute bottom-12 left-12 h-8 w-8 rounded-full bg-teal/20" />
              <Logo variant="color" className="relative z-10 h-auto w-[68%] min-w-[120px]" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 pt-12 md:px-8 md:pt-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-teal-deep">Boletines</p>
            <h2 className="mt-2 font-display text-[32px] font-bold tracking-[-0.025em] md:text-[40px]">Lo último en español</h2>
          </div>
          <Link href="/archive" className="rounded-full border border-line px-4 py-2 font-sans text-[14px] font-semibold text-ink hover:border-ink">
            Ver más
          </Link>
        </div>
        <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1">
          <Link href="/archive" className="shrink-0 rounded-full bg-ink px-3.5 py-1.5 font-sans text-[13px] font-medium text-sand">
            Todos
          </Link>
          {chips.map((t) => (
            <Link
              key={t.slug}
              href={`/t/${t.slug}`}
              className="shrink-0 rounded-full bg-sand-soft px-3.5 py-1.5 font-sans text-[13px] font-medium text-ink-2 hover:bg-sand-muted"
            >
              {tagLabel(t)}
            </Link>
          ))}
        </div>

        {featured && (
          <article className="group relative mt-10 grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-12">
            {featured.image && (
              <div className="relative aspect-[16/9] overflow-hidden rounded-[14px] bg-sand-soft lg:aspect-[16/10]">
                <Image
                  src={featured.image.url}
                  alt=""
                  fill
                  priority
                  sizes="(min-width: 1024px) 720px, 100vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </div>
            )}
            <div className="flex flex-col justify-center">
              {featured.tags[0] && <TagPill tag={featured.tags[0]} />}
              <h3 className="mt-2 font-display text-[28px] font-bold leading-[1.12] tracking-[-0.025em] md:text-[36px]">
                <Link prefetch={false} href={`/p/${featured.slug}`} className="after:absolute after:inset-0 group-hover:text-teal-deep">
                  {featured.title}
                </Link>
              </h3>
              <p className="mt-3 max-w-[36rem] font-sans text-[17px] leading-[1.5] text-ink-2">{featured.subtitle}</p>
              <Meta post={featured} className="mt-4" />
            </div>
          </article>
        )}

        <div className="mt-14 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {latest.map((p) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </div>
      </section>

      {rows.map(({ tag, items }, i) => (
        <section key={tag.slug} className="mx-auto max-w-[1280px] px-5 pt-16 md:px-8 md:pt-20">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <p className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-teal-deep">{tagLabel(tag)}</p>
              <h2 className="mt-1 font-display text-[28px] font-bold tracking-[-0.02em] md:text-[34px]">{tagLabel(tag)}</h2>
            </div>
            <Link href={`/t/${tag.slug}`} className="shrink-0 rounded-full border border-line px-4 py-2 font-sans text-[14px] font-semibold hover:border-ink">
              Ver más
            </Link>
          </div>
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p, j) => (
              <div key={p.slug} className={j === 2 ? "hidden lg:block" : ""}>
                <PostCard post={p} />
              </div>
            ))}
          </div>
          {i === 0 && (
            <div className="mt-16">
              <SubscribeCard placement="band" title="El boletín de Tellus, cada semana en tu correo" />
            </div>
          )}
        </section>
      ))}

      <section className="mx-auto max-w-[1280px] px-5 py-16 md:px-8 md:py-20">
        <div className="overflow-hidden rounded-[14px] bg-teal px-6 py-10 text-sand md:px-12 md:py-14">
          <p className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-sand/80">Hub Tellus</p>
          <h2 className="mt-2 max-w-xl font-display text-[30px] font-bold leading-[1.1] tracking-[-0.025em] md:text-[38px]">
            Un espacio para aprender y construir en Santiago
          </h2>
          <p className="mt-3 max-w-md font-sans text-[17px] leading-[1.5] text-sand/85">
            Eventos, mentorías y comunidad. La cooperativa blockchain de Latinoamérica, en persona.
          </p>
          <a href="/hub" className="cta-pill mt-6 h-11 px-5 text-[12px]">
            Visitar el Hub
          </a>
        </div>
      </section>
    </>
  );
}
