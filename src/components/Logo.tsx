/** Logotipo oficial (PNG del sitio actual de Beehiiv, recortado y optimizado). */
export default function Logo({ variant = "color", className = "h-9 w-auto" }: { variant?: "color" | "white"; className?: string }) {
  const src = variant === "white" ? "/brand/tellus-logo-white-96.webp" : "/brand/tellus-logo-96.webp";
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Tellus Cooperative" width={290} height={96} className={className} />;
}
