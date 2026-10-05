import Link from "next/link";
import Illustration, { type IllustrationName } from "./Illustration";

export default function SectionHeading({
  kicker,
  title,
  href,
  cta = "Ver más",
  illo,
}: {
  kicker: string;
  title: string;
  href?: string;
  cta?: string;
  illo?: IllustrationName;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-teal">{kicker}</p>
        <h2 className="mt-1 font-display text-[32px] font-bold tracking-[-0.025em] md:text-[40px]">{title}</h2>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {illo ? <Illustration name={illo} className="h-14 w-14 rounded-full object-cover md:h-16 md:w-16" /> : null}
        {href ? (
          <Link href={href} className="rounded-full border border-line px-4 py-2 font-sans text-[14px] font-semibold text-ink hover:border-ink">
            {cta}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
