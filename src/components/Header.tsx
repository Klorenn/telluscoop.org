import Link from "next/link";
import Logo from "./Logo";
import PriceTicker from "./PriceTicker";

const NAV = [
  { href: "/t/stellar-en-espanol", label: "Stellar", icon: StarIcon },
  { href: "/t/educacion", label: "Aprende", icon: BookIcon },
  { href: "/t/blockchain", label: "Blockchain", icon: HexIcon },
  { href: "/t/ia", label: "IA", icon: SparkIcon },
  { href: "/archive", label: "Archivo", icon: GridIcon },
];

const TICKER = [
  { href: "/hub", label: "Hub Santiago" },
  { href: "/resources", label: "Recursos" },
  { href: "https://demo.stellarpassport.xyz/org/stellar-chile", label: "Stellar Passport", external: true },
  { href: "/feed.xml", label: "RSS" },
  { href: "/brand", label: "Marca" },
];

export default function Header() {
  return (
    <>
      <div className="bg-ink text-sand">
        <div className="mx-auto flex h-10 max-w-[1280px] items-center justify-center gap-3 px-4 text-center">
          <p className="truncate font-sans text-[13px] font-medium tracking-[-0.01em] sm:text-[14px]">
            Cooperar entre pares. Invertir en colectivo.
          </p>
          <Link href="/#suscribete" className="cta-pill hidden h-7 px-3 text-[10px] sm:inline-flex">
            Suscríbete gratis
          </Link>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-line bg-sand/90 backdrop-blur-[14px]">
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center gap-5 px-4 md:h-[80px] md:gap-6 md:px-8">
          <Link href="/" aria-label="Tellus Cooperative — inicio" className="shrink-0 py-2 pr-3">
            <Logo className="hidden h-[55px] w-auto min-w-[120px] min-[380px]:block" />
            <Logo mark className="block h-10 w-10 object-contain min-[380px]:hidden" />
          </Link>
          <nav aria-label="Principal" className="hidden flex-1 items-center gap-6 lg:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="font-sans text-[15px] font-medium text-ink transition-colors hover:text-teal"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/archive"
              aria-label="Buscar artículos"
              className="grid h-10 w-10 place-items-center rounded-full text-teal-deep hover:bg-sand-soft"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </Link>
            <Link href="/#suscribete" className="cta-pill h-10 px-4 text-[11px] md:px-5 md:text-[12px]">
              <span className="sm:hidden">Suscríbete</span>
              <span className="hidden sm:inline">Suscríbete gratis</span>
            </Link>
          </div>
        </div>

        <nav aria-label="Secciones" className="no-scrollbar flex gap-1 overflow-x-auto border-t border-line px-3 py-2 lg:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 font-sans text-[13px] font-semibold text-ink hover:bg-sand-soft"
            >
              <n.icon />
              {n.label}
            </Link>
          ))}
        </nav>
      </header>

      <PriceTicker />

      <div className="hidden border-b border-line bg-sand md:block">
        <div className="mx-auto flex h-11 max-w-[1280px] items-center gap-6 overflow-hidden px-8 font-sans text-[12px] text-teal-deep">
          <span className="shrink-0 font-semibold uppercase tracking-[0.08em] text-ink">Hecho en LATAM</span>
          <span className="h-4 w-px bg-line" aria-hidden="true" />
          {TICKER.map((t) =>
            t.external ? (
              <a key={t.href} href={t.href} target="_blank" rel="noopener noreferrer" className="shrink-0 hover:text-teal">
                {t.label}
              </a>
            ) : (
              <Link key={t.href} href={t.href} className="shrink-0 hover:text-teal">
                {t.label}
              </Link>
            ),
          )}
        </div>
      </div>
    </>
  );
}

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="m12 3 2.4 6.6H21l-5.4 4.2 2 6.7L12 16.8 6.4 20.5l2-6.7L3 9.6h6.6L12 3Z" />
    </svg>
  );
}
function BookIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  );
}
function HexIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M7 4.5 17 4.5 21.5 12 17 19.5H7L2.5 12 7 4.5Z" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
