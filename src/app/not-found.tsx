import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[720px] px-5 py-20 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/mascot-planets.webp" alt="" width={320} height={260} className="mx-auto h-40 w-auto" />
      <p className="mt-6 font-mono text-[14px] text-clay">404</p>
      <h1 className="mt-3 font-display text-[40px] font-extrabold tracking-[-0.03em]">No encontramos esta página</h1>
      <p className="mt-3 font-display text-[19px] text-ink-2">Puede que el enlace haya cambiado. Prueba en el archivo.</p>
      <Link href="/archive" className="mt-8 inline-block rounded-full bg-mint-btn px-6 py-3 font-sans font-semibold text-ink hover:bg-mint">
        Ir al archivo
      </Link>
    </div>
  );
}
