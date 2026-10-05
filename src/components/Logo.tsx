/** Pau's primary lockup: stacked slab-serif “tellus / cooperative” + terracotta disc.
 *  The τ hexagon is the compact isotype (favicon, tight mobile header). */
const STACKED: Record<"black" | "teal" | "white", string> = {
  black: "/brand/logo-stacked-serif-black.svg",
  teal: "/brand/logo-stacked-serif-teal.svg",
  white: "/brand/logo-stacked-serif-white.svg",
};

const MARK: Record<"black" | "teal" | "white" | "terracotta", string> = {
  black: "/brand/logo-mark-tau-black.svg",
  teal: "/brand/logo-mark-tau-teal.svg",
  white: "/brand/logo-mark-tau-white.svg",
  terracotta: "/brand/logo-mark-tau-terracotta.svg",
};

export default function Logo({
  variant = "black",
  mark = false,
  className = "h-10 w-auto",
}: {
  variant?: "black" | "teal" | "white" | "terracotta";
  mark?: boolean;
  className?: string;
}) {
  const src = mark
    ? MARK[variant === "terracotta" ? "terracotta" : variant]
    : STACKED[variant === "terracotta" ? "black" : variant];
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt="Tellus Cooperative"
      width={mark ? 96 : 216}
      height={mark ? 85 : 70}
      className={className}
      decoding="async"
    />
  );
}
