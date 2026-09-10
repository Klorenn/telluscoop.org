import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED_ORIGINS = new Set(["https://telluscoop.org", "https://www.telluscoop.org"]);
const LOCAL_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;
const corsFor = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && (ALLOWED_ORIGINS.has(origin) || LOCAL_ORIGIN.test(origin)) ? origin : "https://telluscoop.org",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});

const json = (body: unknown, status = 200, origin: string | null = null) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsFor(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
});

const allowedFiles = new Set(["png", "svg", "pdf", "eps"]);
const allowedModes = new Set(["custom", "transparent"]);

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  const headers = corsFor(origin);
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ error: "Método no permitido" }, 405, origin);

  const apiKey = Deno.env.get("QRCODE_MONKEY_API_KEY");
  if (!apiKey) return json({ error: "QRCODE_MONKEY_API_KEY no está configurada" }, 503, origin);

  try {
    const authorization = request.headers.get("Authorization") || "";
    if (!/^Bearer\s+\S+$/i.test(authorization)) return json({ error: "Sesión requerida" }, 401, origin);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: publishableKey || "", Authorization: authorization } });
    if (!userResponse.ok) return json({ error: "Sesión inválida" }, 401, origin);
    const contentLength = Number(request.headers.get("Content-Length") || 0);
    if (contentLength > 5_000_000) return json({ error: "Payload demasiado grande" }, 413, origin);
    const body = await request.json();
    const mode = String(body?.mode || "custom");
    if (!allowedModes.has(mode)) return json({ error: "Modo QR no válido" }, 400, origin);
    const data = String(body?.data || "").trim();
    if (!data) return json({ error: "El contenido es obligatorio" }, 400, origin);
    if (data.length > 4096) return json({ error: "El contenido supera 4096 caracteres" }, 413, origin);
    const file = String(body?.file || "png").toLowerCase();
    if (!allowedFiles.has(file)) return json({ error: "Formato no válido" }, 400, origin);
    const size = Number(body?.size) || 300;
    if (!Number.isInteger(size) || size < 100 || size > 2000) return json({ error: "El tamaño debe estar entre 100 y 2000 px" }, 400, origin);
    for (const field of ["logo", "image"]) if (body?.[field] && String(body[field]).length > 2_000_000) return json({ error: `${field} demasiado grande` }, 413, origin);

    const payload = mode === "transparent"
      ? { data, image: body.image || null, size, x: Number(body.x) || 0, y: Number(body.y) || 0, crop: Boolean(body.crop), file, download: false }
      : { data, size, config: body.config || {}, file, download: false };

    const response = await fetch(`https://qrcode-monkey.p.rapidapi.com/qr/${mode}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "qrcode-monkey.p.rapidapi.com",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return json({ error: "QRCode Monkey devolvió un error", status: response.status }, response.status);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const mime = file === "svg" ? "image/svg+xml" : file === "pdf" ? "application/pdf" : file === "eps" ? "application/postscript" : "image/png";
    return json({ data: `data:${mime};base64,${btoa(binary)}`, file, mime }, 200, origin);
  } catch (error) {
    console.error(error);
    return json({ error: "No se pudo generar el código QR" }, 502, origin);
  }
});
