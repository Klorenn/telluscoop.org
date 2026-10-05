import SubscribeForm from "./SubscribeForm";
import Character, { type CharacterName } from "./Character";

export default function SubscribeCard({
  placement = "inline",
  title = "El boletín de Tellus, cada semana en tu correo",
  body = "Noticias, Stellar y Web3 en español. Gratis, en cinco minutos.",
  compact = false,
  mascot = "greenpill",
}: {
  placement?: string;
  title?: string;
  body?: string;
  compact?: boolean;
  mascot?: CharacterName;
}) {
  return (
    <aside
      className={`relative overflow-hidden rounded-[20px] border border-line bg-cream ${compact ? "px-5 py-6" : "px-5 py-7 md:px-8 md:py-8"}`}
      aria-labelledby={`${placement}-cta-title`}
      data-placement={placement}
    >
      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Suscríbete</p>
      <h2
        id={`${placement}-cta-title`}
        className={`mt-2 max-w-[34rem] font-display font-extrabold leading-[1.15] tracking-[-0.02em] text-ink ${
          compact ? "text-[22px]" : "pr-24 text-[24px] md:text-[28px]"
        }`}
      >
        {title}
      </h2>
      {body && <p className="mt-2 max-w-xl font-display text-[16px] leading-[1.5] text-ink-2">{body}</p>}
      <div className={`relative z-10 ${compact ? "mt-4" : "mt-5"} max-w-lg`}>
        <SubscribeForm placement={placement} source={placement} variant="black" />
      </div>
      <Character
        name={mascot}
        className="pointer-events-none absolute -bottom-5 -right-6 hidden h-32 w-auto select-none sm:block md:-bottom-6 md:-right-4 md:h-40"
      />
    </aside>
  );
}
