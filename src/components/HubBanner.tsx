import Illustration from "./Illustration";

/** Dark rounded band in the same slot Milk Road uses for a sponsor strip. Tellus Hub, original. */
export default function HubBanner({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href="/hub"
      className={`group flex items-center gap-4 overflow-hidden rounded-[16px] bg-ink text-sand ${
        compact ? "px-4 py-3" : "px-5 py-4 md:px-7 md:py-5"
      }`}
    >
      <Illustration name="hub" className="hidden h-14 w-[88px] rounded-md object-cover sm:block" alt="" />
      <div className="min-w-0 flex-1">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-sand/55">Hub Tellus · Santiago</p>
        <p
          className={`mt-0.5 font-display font-bold leading-tight tracking-[-0.02em] ${
            compact ? "text-[17px]" : "text-[19px] md:text-[24px]"
          }`}
        >
          Eventos, mentorías y comunidad. En persona.
        </p>
      </div>
      <span className={`cta-pill shrink-0 ${compact ? "h-9 px-3.5 text-[10px]" : "h-10 px-4 text-[11px] md:h-11 md:px-5"}`}>
        Visitar el Hub
      </span>
    </a>
  );
}
