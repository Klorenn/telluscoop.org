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
    <footer className="mt-24 bg-ink text-white/80">
      <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-16 md:grid-cols-[1.3fr_1fr_1fr] md:px-8">
        <div>
          <Logo variant="white" className="h-10 w-auto" />
          <p className="mt-5 max-w-sm font-sans text-[15px] leading-relaxed text-white/70">
            La cooperativa blockchain de Latinoamérica. Aprende, conecta y emprende en Web3, en español.
          </p>
          <div className="mt-6 max-w-sm">
            <SubscribeForm variant="dark" placement="footer" source="footer" />
          </div>
        </div>
        <div>
          <h2 className="font-sans text-[13px] font-semibold uppercase tracking-wider text-white/50">Categorías</h2>
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
          <h2 className="font-sans text-[13px] font-semibold uppercase tracking-wider text-white/50">Tellus</h2>
          <ul className="mt-4 space-y-2.5 font-sans text-[15px]">
            <li><Link href="/archive" className="hover:text-white">Todos los artículos</Link></li>
            <li><a href="/feed.xml" className="hover:text-white">RSS</a></li>
            <li><a href="/hub" className="hover:text-white">Hub</a></li>
            <li><a href="/resources" className="hover:text-white">Recursos</a></li>
            <li><a href="/brand" className="hover:text-white">Marca</a></li>
            <li>
              <a href="https://demo.stellarpassport.xyz/org/stellar-chile" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                Stellar Passport
              </a>
            </li>
            {social.map((s) => (
              <li key={s.label}>
                <a href={s.href} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-3 px-5 py-6 font-sans text-[13px] text-white/50 md:px-8">
          <span>© {new Date().getFullYear()} Tellus Cooperative</span>
          <span>Hecho en LATAM</span>
        </div>
      </div>
    </footer>
  );
}
