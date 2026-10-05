/** Pau-picked teal illustrated LATAM map. High-res SVG from uploads/mapa latam.svg. */
export default function MapBand() {
  return (
    <section id="mapa" className="mt-16 bg-ink md:mt-20" aria-label="Latinoamérica">
      <div className="mx-auto flex max-w-[1280px] justify-center px-5 py-12 md:px-8 md:py-16">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/mapa-latam.svg"
          alt="Mapa ilustrado de Latinoamérica"
          width={1257}
          height={1554}
          className="h-auto w-full max-w-[680px] object-contain md:max-w-[760px]"
          decoding="async"
        />
      </div>
    </section>
  );
}
