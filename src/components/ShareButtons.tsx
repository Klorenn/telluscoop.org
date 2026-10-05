"use client";
import { useState } from "react";

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
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    { label: "X", href: `https://x.com/intent/post?url=${u}&text=${t}`, icon: <path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" fill="currentColor" /> },
    { label: "in", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, icon: <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4V21H3V9.5Zm6.5 0h3.8v1.6h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.2c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4V9.5Z" fill="currentColor" /> },
  ];
  const rail = layout === "rail";
  return (
    <div className={`${rail ? "flex flex-col items-start gap-3" : "flex items-center gap-2"} ${className}`}>
      <p className={`font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-muted ${rail ? "" : "sr-only"}`}>Compartir</p>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Compartir en ${l.label === "in" ? "LinkedIn" : "X"}`}
          title={l.label}
          className={
            rail
              ? "font-sans text-[14px] font-semibold text-ink hover:text-teal"
              : "grid h-9 w-9 place-items-center rounded-full border border-line text-ink-2 transition-colors hover:border-teal hover:text-teal"
          }
        >
          {rail ? (
            l.label
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              {l.icon}
            </svg>
          )}
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
