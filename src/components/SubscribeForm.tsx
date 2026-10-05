"use client";
import { useState } from "react";

type State = "idle" | "loading" | "ok" | "error";

export default function SubscribeForm({
  variant = "clay",
  source = "web",
  placement,
  size = "md",
  cta = "Suscríbete gratis",
}: {
  variant?: "clay" | "dark";
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
  const dark = variant === "dark";
  const input = dark
    ? "border-sand/25 bg-sand/10 text-sand placeholder:text-sand/50 focus:border-sand/60"
    : "border-line bg-sand-soft text-ink placeholder:text-teal-deep/70 focus:border-teal";

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
        <button type="submit" disabled={state === "loading" || state === "ok"} className={`cta-pill ${h} shrink-0 px-6 text-[11px] md:text-[12px]`}>
          {state === "loading" ? "Enviando…" : state === "ok" ? "¡Suscrito!" : cta}
        </button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={`mt-2 min-h-[1.25rem] font-sans text-[13px] ${
          state === "error" ? (dark ? "text-sand" : "text-clay-deep") : dark ? "text-sand/60" : "text-teal-deep"
        }`}
      >
        {msg || "Gratis. Sin spam. Te desuscribes con un clic."}
      </p>
    </form>
  );
}
