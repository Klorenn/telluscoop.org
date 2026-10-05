import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[700px] px-5 py-24 text-center">
      <p className="font-mono text-[14px] text-clay">404</p>
      <h1 className="mt-3 font-display text-[40px] font-extrabold tracking-[-0.02em]">No encontramos esta página</h1>
      <p className="mt-3 font-display text-[19px] text-ink-2">Puede que el enlace haya cambiado. Prueba en el archivo.</p>
      <Link href="/archive" className="mt-8 inline-block rounded-full bg-teal px-6 py-3 font-sans font-semibold text-white hover:bg-teal-dark">
        Ir al archivo
      </Link>
    </div>
  );
}
