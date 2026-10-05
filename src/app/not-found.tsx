import Link from "next/link";
import Character from "@/components/Character";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[720px] px-5 py-20 text-center">
      <div className="mx-auto grid h-40 w-40 place-items-center overflow-hidden rounded-full bg-ink">
        <Character name="robot-espacio" alt="" className="h-36 w-36 object-contain" />
      </div>
      <p className="mt-6 font-mono text-[14px] uppercase tracking-[0.12em] text-clay">404</p>
      <h1 className="mt-3 font-display text-[40px] font-bold tracking-[-0.03em]">No encontramos esta página</h1>
      <p className="mt-3 font-sans text-[19px] text-ink-2">Puede que el enlace haya cambiado. Prueba en el archivo.</p>
      <Link href="/archive" className="cta-pill mt-8 inline-flex h-12 px-6 text-[12px]">
        Ir al archivo
      </Link>
    </div>
  );
}
