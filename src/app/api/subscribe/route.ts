/**
 * POST /api/subscribe
 * Llama a Beehiiv Create Subscription cuando existe BEEHIIV_API_KEY.
 * Sin la key responde un mensaje amable en español (no crashea).
 *
 * Docs: https://developers.beehiiv.com/api-reference/subscriptions/create
 */
import { NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const PLACEMENTS = new Set(["hero", "inline", "end", "sticky", "exit", "band", "footer", "web"]);
const DEFAULT_PUBLICATION_ID = "pub_30c7e4c1-15ed-46d8-a23d-32c90e011794";
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 8;
const rateMap = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]!.trim().slice(0, 64);
  return req.headers.get("x-real-ip")?.slice(0, 64) || "unknown";
}

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const cur = rateMap.get(ip);
  if (!cur || now >= cur.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (cur.count >= RATE_MAX) return false;
  cur.count += 1;
  return true;
}

function maskEmail(email: string): string {
  return email.replace(/^(.{2}).*(@.*)$/, "$1***$2");
}

type BeehiivErrorBody = {
  status?: number;
  statusText?: string;
  errors?: Array<{ message?: string; code?: string }>;
  message?: string;
};

function spanishBeehiivError(status: number, body: BeehiivErrorBody | null): { status: number; error: string; code?: string } {
  const raw = [
    body?.statusText,
    body?.message,
    ...(body?.errors || []).map((e) => e.message || e.code || ""),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (status === 429) {
    return { status: 429, error: "Demasiados intentos. Espera un momento e inténtalo de nuevo.", code: "rate_limit" };
  }
  if (/already|exist|active|subscribed|duplicate|ya est[aá]/.test(raw) || status === 409) {
    return {
      status: 409,
      error: "Este correo ya está suscrito. Revisa tu bandeja (y spam) o usa otro correo.",
      code: "already_subscribed",
    };
  }
  if (/invalid|email|correo|malformed/.test(raw) || status === 422) {
    return { status: 422, error: "Revisa tu correo: parece que no es válido.", code: "invalid_email" };
  }
  if (status === 401 || status === 403) {
    return { status: 502, error: "No pudimos conectar con el boletín ahora. Inténtalo más tarde.", code: "upstream_auth" };
  }
  return { status: 502, error: "No pudimos suscribirte ahora. Inténtalo de nuevo en un momento.", code: "upstream" };
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(ip)) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos. Espera un momento e inténtalo de nuevo.", code: "rate_limit" },
      { status: 429 },
    );
  }

  let body: {
    email?: string;
    source?: string;
    placement?: string;
    website?: string;
    referring_site?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 });
  }

  // Honeypot: bots rellenan "website"; éxito silencioso.
  if (body.website) {
    return NextResponse.json({ ok: true, message: "¡Listo! Revisa tu correo para confirmar." });
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Revisa tu correo: parece que no es válido.", code: "invalid_email" },
      { status: 422 },
    );
  }

  const placementRaw = String(body.placement || body.source || "web").trim().toLowerCase().slice(0, 32);
  const placement = PLACEMENTS.has(placementRaw) ? placementRaw : "web";
  const referringSite = String(body.referring_site || req.headers.get("referer") || "https://telluscoop.org").slice(0, 500);

  const apiKey = process.env.BEEHIIV_API_KEY?.trim();
  const publicationId = process.env.BEEHIIV_PUBLICATION_ID?.trim() || DEFAULT_PUBLICATION_ID;

  if (!apiKey) {
    console.warn(`[subscribe:unconfigured] ${maskEmail(email)} placement=${placement}`);
    return NextResponse.json(
      {
        ok: false,
        error: "El boletín no está disponible en este momento. Inténtalo más tarde.",
        code: "unconfigured",
      },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(`https://api.beehiiv.com/v2/publications/${publicationId}/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email,
        reactivate_existing: true,
        send_welcome_email: true,
        utm_source: "telluscoop.org",
        utm_medium: placement,
        referring_site: referringSite,
      }),
    });

    let data: BeehiivErrorBody & { data?: { status?: string } } = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      const mapped = spanishBeehiivError(res.status, data);
      console.warn(`[subscribe:beehiiv] ${res.status} ${maskEmail(email)} code=${mapped.code}`);
      return NextResponse.json({ ok: false, error: mapped.error, code: mapped.code }, { status: mapped.status });
    }

    console.log(`[subscribe:live] ${new Date().toISOString()} ${maskEmail(email)} placement=${placement}`);
    return NextResponse.json({
      ok: true,
      mode: "live",
      message: "¡Listo! Revisa tu correo para confirmar la suscripción.",
      status: data?.data?.status,
    });
  } catch (err) {
    console.error(`[subscribe:error] ${maskEmail(email)}`, (err as Error).message);
    return NextResponse.json(
      { ok: false, error: "No pudimos suscribirte ahora. Inténtalo de nuevo en un momento.", code: "network" },
      { status: 502 },
    );
  }
}
