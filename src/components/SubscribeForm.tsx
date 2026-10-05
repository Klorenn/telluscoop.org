"use client";
import { useState } from "react";

type State = "idle" | "loading" | "ok" | "error";

export default function SubscribeForm({
  variant = "mint",
  source = "web",
  placement,
  size = "md",
  cta = "Suscríbete gratis",
}: {
  variant?: "mint" | "ink";
  source?: string;
  placement?: string;
  size?: "md" | "lg";
  cta?: string;
}) {
  const [state, setState] = useState<State>("idle");
  const [msg, setMsg] = useState("");
  const utm = (placement || source || "web").slice(0, 32);
  const fieldId = `email-${utm}`;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setState("error");
      setMsg("Revisa tu correo: parece que no es válido.");
      return;
    }
    setState("loading");
    try {
      const referring_site = typeof window !== "undefined" ? window.location.href : "";
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          source: utm,
          placement: utm,
          website: fd.get("website") || "",
          referring_site,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Error");
      setState("ok");
      setMsg(data.message || "¡Listo! Revisa tu correo para confirmar.");
    } catch (err) {
      setState("error");
      setMsg((err as Error).message || "No pudimos suscribirte. Inténtalo de nuevo.");
    }
  }

  const h = size === "lg" ? "h-14 text-[16px]" : "h-12 text-[15px]";
  const ink = variant === "ink";
  const input = ink
    ? "border-line bg-sand text-ink placeholder:text-muted focus:border-ink"
    : "border-line bg-sand text-ink placeholder:text-muted focus:border-ink";

  return (
    <form onSubmit={onSubmit} noValidate className="w-full">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor={fieldId}>
          Tu correo electrónico
        </label>
        <input
          id={fieldId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="Tu correo electrónico"
          disabled={state === "loading" || state === "ok"}
          className={`${h} w-full min-w-0 rounded-full border px-5 font-sans outline-none transition-colors sm:flex-1 ${input}`}
        />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        <button
          type="submit"
          disabled={state === "loading" || state === "ok"}
          className={`cta-pill relative z-10 ${ink ? "cta-ink text-white" : "text-ink"} ${h} shrink-0 whitespace-nowrap px-6 text-[15px]`}
        >
          {state === "loading" ? "Enviando…" : state === "ok" ? "¡Suscrito!" : cta}
        </button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={`mt-2 min-h-[1.25rem] font-sans text-[13px] ${
          state === "error" ? "text-tick-down" : "text-muted"
        }`}
      >
        {msg || "Gratis. Sin spam. Te desuscribes con un clic."}
      </p>
    </form>
  );
}
