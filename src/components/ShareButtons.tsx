"use client";
import { useState } from "react";
import BrandGlyph from "./BrandGlyph";

const NETWORKS = [
  {
    id: "x",
    label: "X",
    file: "x",
    href: (url: string, title: string) =>
      `https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    file: "linkedin",
    href: (url: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
] as const;

export default function ShareButtons({
  url,
  title,
  className = "",
  layout = "row",
}: {
  url: string;
  title: string;
  className?: string;
  layout?: "row" | "rail";
}) {
  const [copied, setCopied] = useState(false);
  const rail = layout === "rail";

  return (
    <div
      className={`${rail ? "flex flex-col items-start gap-2.5" : "flex items-center gap-2"} ${className}`}
      data-share={layout}
    >
      <p
        className={`font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-muted ${
          rail ? "" : "sr-only"
        }`}
      >
        Compartir
      </p>
      {NETWORKS.map((n) => (
        <a
          key={n.id}
          href={n.href(url, title)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Compartir en ${n.label}`}
          className={
            rail
              ? "grid h-9 w-9 place-items-center rounded-full text-ink transition-colors hover:bg-sand-soft hover:text-teal"
              : "grid h-9 w-9 place-items-center rounded-full border border-line text-ink-2 transition-colors hover:border-teal hover:text-teal"
          }
        >
          <BrandGlyph file={n.file} size={rail ? 16 : 15} />
        </a>
      ))}
      {!rail && (
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {}
          }}
          className="h-9 rounded-full border border-line px-3.5 font-sans text-[13px] font-medium text-ink-2 transition-colors hover:border-teal hover:text-teal"
        >
          {copied ? "¡Copiado!" : "Copiar enlace"}
        </button>
      )}
    </div>
  );
}
