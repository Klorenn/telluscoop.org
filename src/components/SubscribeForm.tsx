"use client";
import { useState } from "react";

type State = "idle" | "loading" | "ok" | "error";

export default function SubscribeForm({
  variant = "light",
  source = "web",
  placement,
  size = "md",
  cta = "Suscríbete gratis",
}: {
  variant?: "light" | "dark";
  /** Alias histórico; se usa como utm_medium si no hay placement. */
  source?: string;
  /** Placement canónico: hero | inline | end | sticky | exit | band | footer */
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

  const dark = variant === "dark";
  const h = size === "lg" ? "h-14 text-[17px]" : "h-12 text-[15px]";
  return (
    <form onSubmit={onSubmit} noValidate className="w-full">
      <div className="flex flex-col gap-2.5 sm:flex-row">
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
          className={`${h} w-full min-w-0 rounded-full border px-5 sm:w-auto sm:flex-1 font-sans outline-none transition-colors ${
            dark
              ? "border-white/20 bg-white/10 text-white placeholder:text-white/50 focus:border-white/60"
              : "border-line bg-white text-ink shadow-[0_1px_0_rgba(0,0,0,0.04)] placeholder:text-muted focus:border-teal"
          }`}
        />
        {/* honeypot anti-bots */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        <button
          type="submit"
          disabled={state === "loading" || state === "ok"}
          className={`${h} shrink-0 rounded-full px-6 font-sans font-semibold transition-colors disabled:opacity-70 ${
            dark ? "bg-white text-ink hover:bg-mint" : "bg-teal text-white hover:bg-teal-dark"
          }`}
        >
          {state === "loading" ? "Enviando…" : state === "ok" ? "¡Suscrito!" : cta}
        </button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={`mt-2 min-h-[1.25rem] font-sans text-[13px] ${
          state === "error" ? (dark ? "text-red-300" : "text-red-700") : dark ? "text-white/60" : "text-muted"
        }`}
      >
        {msg || "Gratis. Sin spam. Te desuscribes con un clic."}
      </p>
    </form>
  );
}
