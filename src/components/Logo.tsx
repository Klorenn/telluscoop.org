/** Official /brand wordmarks. Do not recolor or redraw. */
const WORDMARK: Record<"dark" | "color" | "white", string> = {
  dark: "/brand/logo-dark.svg",
  color: "/brand/logo-color.svg",
  white: "/brand/logo-white.svg",
};

const ICON = "/brand/logo-icon.png";

export default function Logo({
  variant = "dark",
  mark = false,
  className = "h-10 w-auto",
}: {
  variant?: "dark" | "color" | "white" | "black" | "teal";
  mark?: boolean;
  className?: string;
}) {
  const mapped = variant === "black" || variant === "teal" ? "dark" : variant;
  const src = mark ? ICON : WORDMARK[mapped];
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt="Tellus Cooperative"
      width={mark ? 64 : 240}
      height={mark ? 62 : 110}
      className={className}
      decoding="async"
    />
  );
}
