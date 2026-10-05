"use client";
import { useState } from "react";

export default function ShareButtons({ url, title, className = "" }: { url: string; title: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    { label: "Compartir en X", href: `https://x.com/intent/post?url=${u}&text=${t}`, icon: <path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" fill="currentColor" /> },
    { label: "Compartir en LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, icon: <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4V21H3V9.5Zm6.5 0h3.8v1.6h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.2c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21h-4V9.5Z" fill="currentColor" /> },
    { label: "Compartir por WhatsApp", href: `https://wa.me/?text=${t}%20${u}`, icon: <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.5 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.1.3.7 1.1 1.4 1.8 1 .9 1.8 1.1 2 1.3.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.1.1.6-.1 1.1Z" fill="currentColor" /> },
    { label: "Compartir por Telegram", href: `https://t.me/share/url?url=${u}&text=${t}`, icon: <path d="M21.5 4.2 18.4 19c-.2 1-.8 1.3-1.7.8l-4.6-3.4-2.2 2.1c-.2.2-.4.4-.9.4l.3-4.7 8.6-7.8c.4-.3-.1-.5-.6-.2L6.7 12.9l-4.6-1.4c-1-.3-1-1 .2-1.5L20.2 3c.8-.3 1.6.2 1.3 1.2Z" fill="currentColor" /> },
  ];
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={l.label}
          title={l.label}
          className="grid h-9 w-9 place-items-center rounded-full border border-line text-ink-2 transition-colors hover:border-teal hover:text-teal"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            {l.icon}
          </svg>
        </a>
      ))}
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
    </div>
  );
}
