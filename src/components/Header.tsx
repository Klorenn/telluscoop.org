import Link from "next/link";
import Logo from "./Logo";

const NAV = [
  { href: "/t/stellar-en-espanol", label: "Stellar" },
  { href: "/t/educacion", label: "Aprende" },
  { href: "/t/blockchain", label: "Blockchain" },
  { href: "/t/ia", label: "IA" },
  { href: "/archive", label: "Archivo" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-5 md:h-[72px] md:px-8">
        <Link href="/" aria-label="Tellus Cooperative — inicio" className="shrink-0">
          <Logo className="h-8 w-auto md:h-9" />
        </Link>
        <nav aria-label="Principal" className="hidden flex-1 items-center gap-7 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="font-sans text-[15px] font-medium text-ink-2 transition-colors hover:text-teal">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/archive" aria-label="Buscar artículos" className="grid h-10 w-10 place-items-center rounded-full text-ink-2 hover:bg-cream">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </Link>
          <Link
            href="/#suscribete"
            className="rounded-full bg-clay px-4 py-2.5 font-sans text-[14px] font-semibold text-white transition-colors hover:bg-clay-dark md:px-5"
          >
            Suscríbete gratis
          </Link>
        </div>
      </div>
      <nav aria-label="Categorías" className="no-scrollbar flex gap-5 overflow-x-auto border-t border-line px-5 py-2.5 lg:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="shrink-0 font-sans text-[14px] font-medium text-ink-2">
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
