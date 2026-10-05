import Link from "next/link";
import Logo from "./Logo";
import Character from "./Character";
import SubscribeForm from "./SubscribeForm";
import { getPublication, getTags } from "@/lib/content";
import { tagLabel } from "@/lib/site";

export default function Footer() {
  const pub = getPublication();
  const tags = getTags().slice(0, 8);
  const social = [
    { href: pub.social.x, label: "X" },
    { href: pub.social.instagram, label: "Instagram" },
    { href: pub.social.linkedin, label: "LinkedIn" },
    { href: pub.social.youtube, label: "YouTube" },
    { href: pub.social.discord, label: "Discord" },
  ].filter((s) => s.href);

  return (
    <footer className="mt-8 bg-navy text-white/80">
      <div className="border-b border-white/10 bg-cream text-ink">
        <div className="mx-auto grid max-w-[1280px] items-center gap-8 px-5 py-12 md:grid-cols-[1.2fr_1fr] md:px-8 md:py-16">
          <div>
            <p className="font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Suscríbete</p>
            <h2 className="mt-3 font-display text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] md:text-[44px]">
              Convierte curiosidad
              <br />
              en proyectos reales
            </h2>
            <p className="mt-4 max-w-md font-display text-[17px] leading-[1.5] text-ink-2">
              Únete a 5.000+ personas que aprenden blockchain, Stellar y Web3 en español.
            </p>
          </div>
          <div className="relative">
            <SubscribeForm placement="footer" source="footer" variant="mint" size="lg" />
            <Character
              name="tierra-traje"
              className="pointer-events-none absolute -right-2 -top-14 hidden h-24 w-auto lg:block"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1280px] gap-12 px-5 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-8">
        <div>
          <Logo variant="white" className="h-12 w-auto md:h-14" />
          <p className="mt-5 max-w-sm font-sans text-[15px] leading-relaxed text-white/70">
            La cooperativa blockchain de Latinoamérica. Aprende, conecta y emprende en Web3, en español.
          </p>
          {social.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-3 font-sans text-[13px] font-semibold uppercase tracking-wider">
              {social.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="font-sans text-[12px] font-semibold uppercase tracking-[0.12em] text-white/45">Categorías</h2>
          <ul className="mt-4 space-y-2.5 font-sans text-[15px]">
            {tags.map((t) => (
              <li key={t.slug}>
                <Link prefetch={false} href={`/t/${t.slug}`} className="hover:text-white">
                  {tagLabel(t)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-sans text-[12px] font-semibold uppercase tracking-[0.12em] text-white/45">Tellus</h2>
          <ul className="mt-4 space-y-2.5 font-sans text-[15px]">
            <li>
              <Link href="/archive" className="hover:text-white">
                Todos los artículos
              </Link>
            </li>
            <li>
              <a href="/feed.xml" className="hover:text-white">
                RSS
              </a>
            </li>
            <li>
              <a href="/hub" className="hover:text-white">
                Hub
              </a>
            </li>
            <li>
              <a href="/resources" className="hover:text-white">
                Recursos
              </a>
            </li>
            <li>
              <a href="/brand" className="hover:text-white">
                Marca
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="font-sans text-[12px] font-semibold uppercase tracking-[0.12em] text-white/45">Programas</h2>
          <ul className="mt-4 space-y-2.5 font-sans text-[15px]">
            <li>
              <a href="https://demo.stellarpassport.xyz/org/stellar-chile" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                Stellar Passport
              </a>
            </li>
            <li>
              <a href="/stellar" className="hover:text-white">
                Stellar Chile
              </a>
            </li>
            <li>
              <a href="/merch" className="hover:text-white">
                Merch
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-3 px-5 py-6 font-sans text-[13px] text-white/45 md:px-8">
          <span>© {new Date().getFullYear()} Tellus Cooperative. Todos los derechos reservados.</span>
          <span>Hecho en LATAM</span>
        </div>
      </div>
    </footer>
  );
}
