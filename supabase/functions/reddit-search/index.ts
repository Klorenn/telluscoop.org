import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Meme & context finder. Reddit blocks anonymous API access, so "info" mode
// grounds Gemini on Google Search (biased to reddit.com and forums) and
// "memes" mode uses the Giphy API (GIPHY_API_KEY secret, free tier).

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

const MODELS = ["gemini-3.5-flash", "gemini-2.5-flash"];
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

function extractText(data: Record<string, unknown>): string {
  if (typeof data.output_text === "string" && data.output_text) return data.output_text;
  let last = "";
  for (const step of (data.steps as Record<string, unknown>[]) ?? []) {
    for (const content of (step.content as Record<string, unknown>[]) ?? []) {
      if (content.type === "text" && typeof content.text === "string" && content.text.trim()) last = content.text;
    }
  }
  return last;
}

function parseJsonLoose(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return {};
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function collectSources(data: Record<string, unknown>): { url: string; title: string }[] {
  const sources = new Map<string, string>();
  for (const step of (data.steps as Record<string, unknown>[]) ?? []) {
    for (const content of (step.content as Record<string, unknown>[]) ?? []) {
      for (const ann of (content.annotations as Record<string, unknown>[]) ?? []) {
        if (ann.type === "url_citation" && ann.url) sources.set(String(ann.url), String(ann.title ?? ann.url));
      }
    }
  }
  return [...sources].map(([url, title]) => ({ url, title }));
}

async function searchInfo(apiKey: string, query: string) {
  const input = `Busca qué se está diciendo ahora sobre "${query}" en Reddit y en foros/comunidades (prioriza resultados de reddit.com en la búsqueda). Resume la conversación real: opiniones, dudas, chistes recurrentes y datos que la gente comparte.

Después, escribe 3 posts LISTOS para publicar en X sobre el tema, en español chileno neutro (tuteo, natural, sin voseo argentino ni españolismos), voz Tellus Cooperative: con gancho, humanos, aprovechando el humor o el ángulo que domina la conversación, <=270 caracteres, máximo 1 hashtag, sin emojis excesivos. Cada post debe poder acompañarse de un GIF/meme.

Responde ÚNICAMENTE con un objeto JSON válido, sin bloques de código ni texto extra:
{"resumen": "2-3 frases con el pulso de la conversación", "puntos": ["4-6 puntos clave: qué se comenta, qué polariza, qué memes circulan"], "posts": ["3 posts listos para publicar"], "gif_busqueda": "2-3 palabras en inglés para buscar el GIF perfecto para estos posts"}`;

  const errors: string[] = [];
  for (const model of MODELS) {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input, tools: [{ type: "google_search" }] }),
    });
    const text = await response.text();
    if (response.ok) {
      const data = JSON.parse(text) as Record<string, unknown>;
      if (data.error) { errors.push(`${model}: ${JSON.stringify(data.error).slice(0, 160)}`); continue; }
      const parsed = parseJsonLoose(extractText(data));
      return {
        summary: String(parsed.resumen ?? "").trim() || extractText(data).slice(0, 500),
        points: Array.isArray(parsed.puntos) ? parsed.puntos.map((p: unknown) => String(p)) : [],
        posts: Array.isArray(parsed.posts) ? parsed.posts.map((p: unknown) => String(p)) : [],
        gifQuery: String(parsed.gif_busqueda ?? "").trim(),
        sources: collectSources(data),
        model,
      };
    }
    errors.push(`${model} ${response.status}: ${text.slice(0, 160)}`);
  }
  throw new Error(`Gemini falló → ${errors.join(" | ")}`);
}

async function searchGifs(giphyKey: string, query: string, limit: number) {
  const url = `https://api.giphy.com/v1/gifs/search?api_key=${giphyKey}&q=${encodeURIComponent(query)}&limit=${limit}&rating=pg-13&lang=es`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Giphy ${response.status}`);
  const data = await response.json();
  return ((data.data ?? []) as Record<string, unknown>[]).map((g) => {
    const images = g.images as Record<string, Record<string, string>> | undefined;
    return {
      title: String(g.title ?? ""),
      url: images?.original?.url ?? "",
      thumbnail: images?.fixed_height?.url ?? images?.original?.url ?? "",
      page: String(g.url ?? ""),
    };
  }).filter((g) => g.url);
}

async function searchOpenverse(query: string, limit: number) {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=${limit}&mature=false`;
  const response = await fetch(url, { headers: { "User-Agent": "TellusSocialOps/1.0 (telluscoop.org)" } });
  if (!response.ok) return [];
  const data = await response.json();
  return ((data.results ?? []) as Record<string, unknown>[]).map((r) => ({
    title: String(r.title ?? ""),
    url: String(r.url ?? ""),
    thumbnail: String(r.thumbnail ?? r.url ?? ""),
    page: String(r.foreign_landing_url ?? r.url ?? ""),
  })).filter((r) => r.url);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Sesión requerida" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Sesión inválida" }, 401);

    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .neq("role", "viewer")
      .maybeSingle();
    if (!membership) return json({ error: "Solo el equipo puede buscar" }, 403);

    const body = await request.json();
    const query = String(body.query ?? "").trim();
    if (!query) return json({ error: "Falta query" }, 400);
    const limit = Math.max(1, Math.min(25, Number(body.count) || 12));

    if (body.mode === "memes") {
      const giphyKey = Deno.env.get("GIPHY_API_KEY");
      if (giphyKey) {
        // A bad key or Giphy hiccup should degrade to Openverse, not to nothing.
        const items = await searchGifs(giphyKey, query, limit).catch(() => []);
        if (items.length) return json({ items, mode: "memes", via: "giphy" });
      }
      // No Giphy key yet: Openverse serves CC images keyless so every post
      // still gets a visual. GIFs animados llegan cuando carguen GIPHY_API_KEY.
      const items = await searchOpenverse(query, limit);
      return json({
        items,
        mode: "memes",
        via: "openverse",
        ...(items.length ? {} : { message: "Sin imágenes para ese tema. Para GIFs animados configurá GIPHY_API_KEY (gratis)." }),
      });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "Gemini todavía no está configurado" }, 503);
    const info = await searchInfo(apiKey, query);
    return json({ ...info, mode: "info" });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Error" }, 500);
  }
});
