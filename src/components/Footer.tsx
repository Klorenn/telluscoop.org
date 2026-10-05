import Link from "next/link";
import Logo from "./Logo";
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
    <footer className="mt-8 bg-ink text-sand/80">
      <div className="border-b border-sand/10 bg-sand-soft text-ink">
        <div className="mx-auto grid max-w-[1280px] items-center gap-8 px-5 py-12 md:grid-cols-[1.2fr_1fr] md:px-8 md:py-16">
          <div>
            <p className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-teal-deep">Suscríbete</p>
            <h2 className="mt-3 font-display text-[32px] font-bold leading-[1.05] tracking-[-0.03em] md:text-[44px]">
              El boletín, cada semana
              <br />
              en tu correo
            </h2>
            <p className="mt-4 max-w-md font-sans text-[17px] leading-[1.5] text-ink-2">
              Únete a 5.000+ personas que aprenden blockchain, Stellar y Web3 en español.
            </p>
          </div>
          <SubscribeForm placement="footer" source="footer" size="lg" />
        </div>
      </div>

      <div className="mx-auto grid max-w-[1280px] gap-12 px-5 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-8">
        <div>
          <Logo variant="white" className="h-14 w-auto min-w-[120px]" />
          <p className="mt-5 max-w-sm font-sans text-[15px] leading-relaxed text-sand/70">
            La cooperativa blockchain de Latinoamérica. Aprende, conecta y emprende en Web3, en español.
          </p>
          {social.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-3 font-sans text-[13px] font-semibold uppercase tracking-wider">
              {social.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="hover:text-sand">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="font-sans text-[12px] font-semibold uppercase tracking-[0.12em] text-sand/45">Categorías</h2>
          <ul className="mt-4 space-y-2.5 font-sans text-[15px]">
            {tags.map((t) => (
              <li key={t.slug}>
                <Link prefetch={false} href={`/t/${t.slug}`} className="hover:text-sand">
                  {tagLabel(t)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-sans text-[12px] font-semibold uppercase tracking-[0.12em] text-sand/45">Tellus</h2>
          <ul className="mt-4 space-y-2.5 font-sans text-[15px]">
            <li>
              <Link href="/archive" className="hover:text-sand">
                Todos los artículos
              </Link>
            </li>
            <li>
              <a href="/feed.xml" className="hover:text-sand">
                RSS
              </a>
            </li>
            <li>
              <a href="/hub" className="hover:text-sand">
                Hub
              </a>
            </li>
            <li>
              <a href="/resources" className="hover:text-sand">
                Recursos
              </a>
            </li>
            <li>
              <a href="/brand" className="hover:text-sand">
                Marca
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="font-sans text-[12px] font-semibold uppercase tracking-[0.12em] text-sand/45">Programas</h2>
          <ul className="mt-4 space-y-2.5 font-sans text-[15px]">
            <li>
              <a href="https://demo.stellarpassport.xyz/org/stellar-chile" target="_blank" rel="noopener noreferrer" className="hover:text-sand">
                Stellar Passport
              </a>
            </li>
            <li>
              <a href="/stellar" className="hover:text-sand">
                Stellar Chile
              </a>
            </li>
            <li>
              <a href="/merch" className="hover:text-sand">
                Merch
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-sand/10">
        <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-3 px-5 py-6 font-sans text-[13px] text-sand/45 md:px-8">
          <span>© {new Date().getFullYear()} Tellus Cooperative. Todos los derechos reservados.</span>
          <span>Hecho en LATAM</span>
        </div>
      </div>
    </footer>
  );
}
