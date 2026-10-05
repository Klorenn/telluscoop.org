import Link from "next/link";

export default function SectionHeading({
  kicker,
  title,
  href,
  cta = "Ver más",
}: {
  kicker: string;
  title: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-teal">{kicker}</p>
        <h2 className="mt-1 font-display text-[32px] font-bold tracking-[-0.025em] md:text-[40px]">{title}</h2>
      </div>
      {href ? (
        href.startsWith("http") ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-full border border-line px-4 py-2 font-sans text-[14px] font-semibold text-ink hover:border-ink"
          >
            {cta}
          </a>
        ) : (
          <Link
            href={href}
            className="shrink-0 rounded-full border border-line px-4 py-2 font-sans text-[14px] font-semibold text-ink hover:border-ink"
          >
            {cta}
          </Link>
        )
      ) : null}
    </div>
  );
}
