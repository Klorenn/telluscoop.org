import Image from "next/image";
import Link from "next/link";
import SubscribeForm from "@/components/SubscribeForm";
import SubscribeCard from "@/components/SubscribeCard";
import Illustration, { TAG_ILLUSTRATIONS, type IllustrationName } from "@/components/Illustration";
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

      <section id="suscribete">
        <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-5 py-16 md:grid-cols-2 md:px-8 md:py-24 lg:gap-14">
          <div className="space-y-6">
            <h1 className="font-display text-[42px] font-bold leading-[0.95] tracking-[-0.035em] text-ink sm:text-[56px] lg:text-[72px]">
              Convierte
              <br />
              <em>curiosidad</em>
              <br />
              en proyectos reales
            </h1>
            <p className="max-w-[32rem] font-sans text-[17px] leading-[1.55] text-ink-2 md:text-[20px]">
              Noticias, cursos y herramientas para entender blockchain, Stellar y Web3. Todo en español, directo a tu correo.
            </p>
            <div className="max-w-[34rem]">
              <SubscribeForm placement="hero" source="hero" size="lg" />
            </div>
          </div>
          <div className="relative mx-auto h-[280px] w-full max-w-[560px] sm:h-[380px] md:h-[460px]">
            <div className="hero-blob absolute inset-y-[6%] right-[-8%] left-[8%]" aria-hidden="true" />
            <Illustration
              name="hero"
              alt=""
              className="absolute bottom-0 left-[-2%] h-[96%] w-auto max-w-none object-contain"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 pt-8 md:px-8 md:pt-12">
        <p className="font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-teal">Boletines</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <Illustration name="archive" className="h-12 w-12 object-contain md:h-14 md:w-14" />
            <h2 className="font-display text-[32px] font-bold tracking-[-0.025em] md:text-[40px]">Lo último en español</h2>
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
              <div className="relative aspect-[16/9] overflow-hidden rounded-[20px] bg-sand-soft lg:aspect-[16/10]">
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
              <p className="mt-3 max-w-[36rem] font-sans text-[18px] leading-[1.5] text-ink-2">{featured.subtitle}</p>
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

      {rows.map(({ tag, items }, i) => {
        const illo = TAG_ILLUSTRATIONS[tag.slug] as IllustrationName | undefined;
        return (
          <section key={tag.slug} className="mx-auto max-w-[1280px] px-5 pt-16 md:px-8 md:pt-20">
            <div className="mb-7 flex items-end justify-between gap-4">
              <div className="flex items-center gap-3 md:gap-4">
                {illo ? <Illustration name={illo} className="h-12 w-12 shrink-0 object-contain md:h-16 md:w-16" /> : null}
                <div>
                  <p className="font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-teal">{tagLabel(tag)}</p>
                  <h2 className="mt-1 font-display text-[28px] font-bold tracking-[-0.02em] md:text-[34px]">{tagLabel(tag)}</h2>
                </div>
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
        );
      })}

      <section className="mx-auto max-w-[1280px] px-5 py-16 md:px-8 md:py-20">
        <div className="grid items-center gap-8 overflow-hidden rounded-[20px] bg-teal px-6 py-10 text-sand md:grid-cols-[1.2fr_1fr] md:px-12 md:py-14">
          <div>
            <p className="font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-sand/80">Hub Tellus</p>
            <h2 className="mt-2 font-display text-[30px] font-bold leading-[1.1] tracking-[-0.025em] md:text-[38px]">
              Un espacio para aprender y construir en Santiago
            </h2>
            <p className="mt-3 max-w-md font-sans text-[17px] leading-[1.5] text-sand/85">
              Eventos, mentorías y comunidad. La cooperativa blockchain de Latinoamérica, en persona.
            </p>
            <a href="/hub" className="cta-pill mt-6 h-11 px-5 text-[12px]">
              Visitar el Hub
            </a>
          </div>
          <Illustration name="hub" className="mx-auto h-auto w-full max-w-md rounded-[16px] object-cover" />
        </div>
      </section>
    </>
  );
}
