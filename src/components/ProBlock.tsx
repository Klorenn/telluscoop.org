import Character from "./Character";
import SubscribeForm from "./SubscribeForm";

const PERKS = [
  "Accede a nuestra lista de ideas de alta convicción, actualizada cada semana.",
  "Adelántate a la narrativa con análisis semanal de tendencias.",
  "Participa en AMAs en vivo con nuestros expertos y una comunidad seria.",
  "Accede a contenido educativo exclusivo para llevar tus proyectos al siguiente nivel.",
];

export default function ProBlock() {
  return (
    <section className="mt-16 bg-[#eef8fb] md:mt-20">
      <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-5 py-14 md:grid-cols-2 md:gap-6 md:px-8 md:py-20">
        <div className="relative mx-auto flex h-[280px] w-full max-w-[480px] items-end justify-center sm:h-[360px] md:h-[420px]">
          <div className="hero-blob absolute inset-[8%] opacity-90" aria-hidden="true" />
          <Character name="pro" alt="" className="relative z-[1] h-full w-auto max-w-full object-contain object-bottom" />
        </div>
        <div className="max-w-[36rem]">
          <p className="font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-teal">Tellus PRO</p>
          <h2 className="mt-2 font-display text-[36px] font-bold leading-[1.05] tracking-[-0.03em] md:text-[48px]">
            Posiciónate para lo que viene
          </h2>
          <p className="mt-4 font-sans text-[17px] leading-[1.5] text-ink-2">
            Hecho para quienes dejaron de improvisar y quieren construir con criterio dentro del ecosistema blockchain.
          </p>
          <ul className="mt-6 space-y-3">
            {PERKS.map((item) => (
              <li key={item} className="flex gap-3 font-sans text-[15px] leading-[1.45] text-ink">
                <span
                  className="mt-[2px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-tick-up text-[11px] font-bold leading-none text-white"
                  aria-hidden="true"
                >
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-8 max-w-lg">
            <SubscribeForm placement="pro" source="pro" size="lg" cta="Suscríbete a PRO" />
          </div>
        </div>
      </div>
    </section>
  );
}
