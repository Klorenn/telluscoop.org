/** Lockup 2023 from Pau's Figma — hex rings + “tellus Cooperative”. */
export default function Logo({
  variant = "color",
  className = "h-9 w-auto",
}: {
  variant?: "color" | "white";
  className?: string;
}) {
  const src = variant === "white" ? "/brand/logo-horizontal-white.webp" : "/brand/logo-horizontal.webp";
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Tellus Cooperative" width={560} height={179} className={className} />;
}
