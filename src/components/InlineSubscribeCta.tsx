import SubscribeForm from "./SubscribeForm";

export default function InlineSubscribeCta() {
  return (
    <aside
      className="my-10 rounded-2xl border border-line bg-cream px-5 py-6 md:my-12 md:px-8 md:py-8"
      aria-labelledby="inline-cta-title"
      data-placement="inline"
    >
      <p className="font-sans text-[12px] font-semibold uppercase tracking-[0.08em] text-clay">Boletín Tellus</p>
      <h2 id="inline-cta-title" className="mt-2 font-display text-[22px] font-extrabold leading-[1.2] tracking-[-0.015em] md:text-[26px]">
        ¿Sigues leyendo? Lleva esto a tu correo
      </h2>
      <p className="mt-2 max-w-xl font-display text-[16px] leading-[1.5] text-ink-2 md:text-[17px]">
        Guías, Stellar y Web3 en español, una vez a la semana. Gratis.
      </p>
      <div className="mt-4 max-w-lg">
        <SubscribeForm placement="inline" source="inline" cta="Quiero suscribirme" />
      </div>
    </aside>
  );
}
