import Image from "next/image";
import Link from "next/link";
import SubscribeForm from "@/components/SubscribeForm";
import SubscribeCard from "@/components/SubscribeCard";
import HubBanner from "@/components/HubBanner";
import SectionHeading from "@/components/SectionHeading";
import Illustration, { TAG_ILLUSTRATIONS, type IllustrationName } from "@/components/Illustration";
import { Meta, PostCard, TagPill } from "@/components/PostCard";
import { getAllSummaries, getPostsByTag, getPublication, getTags } from "@/lib/content";
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
  const pub = getPublication();

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
        <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-5 py-14 md:grid-cols-2 md:px-8 md:py-20 lg:gap-8">
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
            <p className="font-sans text-[13px] font-semibold uppercase tracking-[0.08em] text-ink">
              El boletín semanal para construir en Web3
            </p>
            <div className="max-w-[34rem]">
              <SubscribeForm placement="hero" source="hero" size="lg" />
            </div>
          </div>
          <div className="relative mx-auto h-[280px] w-full max-w-[560px] sm:h-[380px] md:h-[460px]">
            <div className="hero-blob absolute inset-y-[4%] right-[-10%] left-[6%]" aria-hidden="true" />
            <Illustration
              name="hero"
              alt=""
              className="relative z-[1] h-full w-full object-contain object-bottom"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 md:px-8">
        <HubBanner />
      </section>

      <section className="mx-auto max-w-[1280px] px-5 pt-12 md:px-8 md:pt-16">
        <SectionHeading kicker="Boletines" title="Lo último en español" href="/archive" illo="archive" />
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

      <section className="mx-auto max-w-[1280px] px-5 pt-16 md:px-8 md:pt-20">
        <SectionHeading kicker="Encuentros" title="Aprende en vivo, en español" href="/hub" cta="Ver el Hub" illo="events" />
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          <a href="/hub" className="group rounded-[20px] bg-sand-soft p-6 ring-1 ring-line transition-colors hover:ring-ink">
            <Illustration name="hub" className="h-28 w-full rounded-[12px] object-cover" />
            <h3 className="mt-4 font-display text-[22px] font-bold tracking-[-0.02em]">Hub Santiago</h3>
            <p className="mt-2 font-sans text-[15px] leading-[1.5] text-ink-2">Eventos, mentorías y un espacio para construir en persona.</p>
          </a>
          {pub.social.youtube ? (
            <a
              href={pub.social.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-[20px] bg-sand-soft p-6 ring-1 ring-line transition-colors hover:ring-ink"
            >
              <Illustration name="ia" className="h-28 w-28 rounded-full object-cover" />
              <h3 className="mt-4 font-display text-[22px] font-bold tracking-[-0.02em]">YouTube</h3>
              <p className="mt-2 font-sans text-[15px] leading-[1.5] text-ink-2">Sesiones y charlas de la cooperativa, en el canal de Tellus.</p>
            </a>
          ) : null}
          {pub.social.discord ? (
            <a
              href={pub.social.discord}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-[20px] bg-sand-soft p-6 ring-1 ring-line transition-colors hover:ring-ink"
            >
              <Illustration name="community" className="h-28 w-28 rounded-full object-cover" />
              <h3 className="mt-4 font-display text-[22px] font-bold tracking-[-0.02em]">Discord</h3>
              <p className="mt-2 font-sans text-[15px] leading-[1.5] text-ink-2">La conversación diaria de miembros y builders en LATAM.</p>
            </a>
          ) : null}
        </div>
      </section>

      {rows.map(({ tag, items }, i) => {
        const illo = TAG_ILLUSTRATIONS[tag.slug] as IllustrationName | undefined;
        return (
          <section key={tag.slug} className="mx-auto max-w-[1280px] px-5 pt-16 md:px-8 md:pt-20">
            <SectionHeading kicker={tagLabel(tag)} title={tagLabel(tag)} href={`/t/${tag.slug}`} illo={illo} />
            <div className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="grid items-center gap-10 overflow-hidden rounded-[20px] bg-ink px-6 py-10 text-sand md:grid-cols-[1.15fr_1fr] md:px-12 md:py-14">
          <div>
            <p className="font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-sand/55">Hub Tellus</p>
            <h2 className="mt-2 font-display text-[30px] font-bold leading-[1.1] tracking-[-0.025em] md:text-[38px]">
              De aprender a construir, con otras personas
            </h2>
            <p className="mt-3 max-w-md font-sans text-[17px] leading-[1.5] text-sand/80">
              La cooperativa blockchain de Latinoamérica. Educación, incubación y un espacio en Santiago.
            </p>
            <ul className="mt-6 space-y-2.5 font-sans text-[16px] text-sand/90">
              <li>Cursos y boletines en español, sin jerga de más.</li>
              <li>Eventos y mentorías para pasar de la idea al proyecto.</li>
              <li>Una comunidad de 4.500+ miembros en 12 capítulos.</li>
            </ul>
            <a href="/hub" className="cta-pill mt-8 h-11 px-5 text-[12px]">
              Visitar el Hub
            </a>
          </div>
          <Illustration name="hub" className="mx-auto h-auto w-full max-w-md rounded-[16px] object-cover" />
        </div>
      </section>
    </>
  );
}
