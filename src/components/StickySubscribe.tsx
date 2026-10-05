"use client";
import { useEffect, useState } from "react";
import SubscribeForm from "./SubscribeForm";

/** Barra fija en móvil tras scrollear ~45% de la página. No intrusiva, se puede cerrar. */
export default function StickySubscribe() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const progress = window.scrollY / max;
      setVisible(progress > 0.35 && progress < 0.92);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [dismissed]);

  if (dismissed || !visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-sand/95 p-3 shadow-[0_-8px_24px_rgba(16,16,16,0.12)] backdrop-blur md:hidden"
      role="complementary"
      aria-label="Suscripción rápida"
      data-placement="sticky"
    >
      <div className="mx-auto flex max-w-[700px] items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="mb-2 font-display text-[15px] font-bold leading-tight text-ink">Recibe Tellus en tu correo</p>
          <SubscribeForm placement="sticky" source="sticky" size="md" cta="Suscribirme" />
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="mt-1 shrink-0 rounded-full p-1.5 font-sans text-[18px] leading-none text-teal-deep hover:bg-sand-soft hover:text-ink"
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>
    </div>
  );
}
