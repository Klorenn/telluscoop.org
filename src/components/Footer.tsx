import Link from "next/link";
import Logo from "./Logo";
import SubscribeCard from "./SubscribeCard";
import SocialIcons from "./SocialIcons";
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
      <div className="border-b border-sand/10 bg-sand px-5 py-12 md:px-8 md:py-16">
        <div className="mx-auto max-w-[1280px]">
          <SubscribeCard
            placement="footer"
            title="El boletín de Tellus, cada semana en tu correo"
            body="Aprende blockchain, Stellar y Web3 en español. Gratis, cada semana."
          />
        </div>
      </div>

      <div className="mx-auto grid max-w-[1280px] gap-12 px-5 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-8">
        <div>
          <Logo variant="white" className="h-14 w-auto min-w-[120px]" />
          <p className="mt-5 max-w-sm font-sans text-[15px] leading-relaxed text-sand/70">
            La cooperativa blockchain de Latinoamérica. Aprende, conecta y emprende en Web3, en español.
          </p>
          {social.length > 0 && <SocialIcons links={social} />}
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
