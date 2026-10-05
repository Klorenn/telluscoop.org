import SubscribeForm from "./SubscribeForm";
import Character from "./Character";

/** Reserved column for the Explora astronaut. Never overlays the form. Hidden on small screens. */
export function SubscribeMascot({
  size = "md",
  from = "md",
}: {
  size?: "md" | "lg";
  from?: "md" | "lg";
}) {
  const box = size === "lg" ? "h-44 w-44 lg:h-52 lg:w-52" : "h-36 w-36 lg:h-44 lg:w-44";
  const vis = from === "lg" ? "hidden lg:flex" : "hidden md:flex";
  return (
    <div className={`${vis} shrink-0 items-end justify-center self-end ${box}`} aria-hidden="true">
      <Character name="emprendimiento" className="h-full w-full object-contain object-bottom" />
    </div>
  );
}

export default function SubscribeCard({
  placement = "inline",
  title = "El boletín de Tellus, cada semana en tu correo",
  body = "Noticias, Stellar y Web3 en español. Gratis, en cinco minutos.",
  compact = false,
}: {
  placement?: string;
  title?: string;
  body?: string;
  compact?: boolean;
}) {
  return (
    <aside
      className={`rounded-[20px] border border-line bg-sand-soft ${compact ? "px-5 py-6" : "px-5 py-7 md:px-8 md:py-8"}`}
      aria-labelledby={`${placement}-cta-title`}
      data-placement={placement}
    >
      <div className="grid items-end gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Suscríbete</p>
          <h2
            id={`${placement}-cta-title`}
            className={`mt-2 max-w-[34rem] font-display font-bold leading-[1.15] tracking-[-0.02em] text-ink ${
              compact ? "text-[22px]" : "text-[24px] md:text-[28px]"
            }`}
          >
            {title}
          </h2>
          {body && <p className="mt-2 max-w-xl font-sans text-[16px] leading-[1.5] text-ink-2">{body}</p>}
          <div className={`relative z-10 ${compact ? "mt-4" : "mt-5"} max-w-lg`}>
            <SubscribeForm placement={placement} source={placement} variant="ink" />
          </div>
        </div>
        <SubscribeMascot size={compact ? "md" : "lg"} />
      </div>
    </aside>
  );
}
