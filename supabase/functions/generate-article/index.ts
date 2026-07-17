import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://telluscoop.org",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

// Ordered fallback: 3.5-flash rejects with "high demand" often; 3-flash-preview picks up.
const MODELS = ["gemini-3.5-flash", "gemini-3-flash-preview", "gemini-2.5-flash"];
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

async function callGemini(apiKey: string, input: string, useTools = true): Promise<{ data: Record<string, unknown>; model: string }> {
  const errors: string[] = [];
  for (const model of MODELS) {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input,
        ...(useTools ? { tools: [{ type: "google_search" }, { type: "url_context" }] } : {}),
      }),
    });

    const text = await response.text();
    if (response.ok) {
      const data = JSON.parse(text) as Record<string, unknown>;
      // The interactions API can 200 with an error payload (e.g. model overloaded).
      if (!data.error) return { data, model };
      errors.push(`${model}: ${JSON.stringify(data.error).slice(0, 200)}`);
      continue;
    }
    errors.push(`${model} ${response.status}: ${text.slice(0, 200)}`);
  }
  throw new Error(`Gemini falló con todos los modelos → ${errors.join(" | ")}`);
}

// With tools active, output_text is often absent: the answer lives in the last
// text block of the steps array.
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

// The interactions API ignores response_format when tools are active, so the
// JSON contract goes in the prompt and we parse leniently.
const ARTICLE_JSON_CONTRACT = `Responde ÚNICAMENTE con un objeto JSON válido, sin bloques de código ni texto extra:
{"titulo": "Título SEO, 5-6 palabras, con el tema central del día", "subtitulo": "1 frase que resume los 2-3 hechos clave", "resumen": ["3 a 5 bullets: qué pasó y por qué importa"], "cuerpo_md": "Desarrollo + En foco + Cierre Tellus, en Markdown con subtítulos"}`;

const POST_JSON_CONTRACT = `Responde ÚNICAMENTE con un objeto JSON válido, sin bloques de código ni texto extra:
{"post": "Post principal para X en español LATAM, <=280 caracteres, con gancho y el enlace del repo", "thread": ["0-3 tweets extra de hilo, opcionales"], "hashtags": ["2-4 hashtags relevantes sin espacios"]}`;

interface Draft {
  title: string;
  subtitle: string;
  summary: string[];
  body_md: string;
  sources: { url: string; title: string }[];
  model: string;
}

interface RepoContext {
  full_name?: string;
  description?: string;
  url?: string;
  language?: string;
  stars?: number;
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

function yesterdayISO(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function generateOne(apiKey: string, promptMd: string, date: string): Promise<Draft> {
  const input = `${promptMd}\n\nResume lo ocurrido el día anterior: ${date}. Usa Google Search para verificar cada hecho y cita fuentes reales y recientes. Fecha de publicación: hoy.\n\n${ARTICLE_JSON_CONTRACT}`;

  const { data, model } = await callGemini(apiKey, input);
  const text = extractText(data);
  const parsed = parseJsonLoose(text);

  const draft: Draft = {
    title: String(parsed.titulo ?? "").trim(),
    subtitle: String(parsed.subtitulo ?? "").trim(),
    summary: Array.isArray(parsed.resumen) ? parsed.resumen.map((s: unknown) => String(s)) : [],
    body_md: String(parsed.cuerpo_md ?? "").trim(),
    sources: collectSources(data),
    model,
  };

  // Model answered in prose instead of JSON: keep the content, don't drop it.
  if (!draft.body_md && text.trim()) {
    draft.title = draft.title || "Borrador sin formato";
    draft.body_md = text.trim();
  }
  if (!draft.body_md) throw new Error(`El modelo ${model} devolvió una respuesta vacía`);
  return draft;
}

async function generatePost(apiKey: string, repo: RepoContext): Promise<Draft> {
  const input = `Escribe un post para X (Twitter) en español LATAM con la voz editorial de Tellus Cooperative sobre este repositorio de GitHub.

Repositorio: ${repo.full_name ?? ""}
Descripción: ${repo.description ?? ""}
Lenguaje: ${repo.language ?? ""}
Estrellas: ${repo.stars ?? ""}
Enlace: ${repo.url ?? ""}

Usa Google Search para entender qué hace el proyecto y por qué es interesante. El post principal debe tener gancho, ser claro y humano (sin hype ni tono trader), explicar en una línea por qué importa, e incluir el enlace del repo. Opcionalmente agrega 1-3 tweets de hilo con más detalle. Nada de emojis excesivos.

${POST_JSON_CONTRACT}`;

  const { data, model } = await callGemini(apiKey, input);
  const text = extractText(data);
  const parsed = parseJsonLoose(text);
  const thread = Array.isArray(parsed.thread) ? parsed.thread.map((t: unknown) => String(t)) : [];
  const hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.map((h: unknown) => String(h)) : [];
  const body = [String(parsed.post ?? "").trim(), ...thread].filter(Boolean).join("\n\n") || text.trim();
  if (!body) throw new Error(`El modelo ${model} devolvió una respuesta vacía`);

  return {
    title: repo.full_name ?? "Post para X",
    subtitle: repo.description ?? "",
    summary: hashtags,
    body_md: body,
    sources: collectSources(data),
    model,
  };
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
    if (!membership) return json({ error: "Solo el equipo puede generar artículos" }, 403);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    console.log("→ GEMINI_API_KEY present:", !!apiKey, "length:", apiKey?.length ?? 0);
    if (!apiKey) return json({ error: "Gemini todavía no está configurado" }, 503);

    const body = await request.json();

    // Mode: social posts (X + WhatsApp + LinkedIn) for a published article,
    // each one carrying the Beehiiv link.
    if (body.format === "social_posts") {
      const article = body.article as Record<string, unknown> | undefined;
      if (!article || typeof article !== "object" || !article.title) return json({ error: "Falta el artículo" }, 400);
      const link = String(body.link ?? "").trim();
      if (!link) return json({ error: "Falta el link de Beehiiv" }, 400);

      const summary = Array.isArray(article.summary) ? article.summary.map((s: unknown) => `- ${String(s)}`).join("\n") : "";
      const input = `Sos el equipo editorial de Tellus Cooperative. A partir de este artículo ya publicado, escribe un post para cada canal, en español LATAM, claro y humano (sin hype ni tono trader). Cada post DEBE incluir este enlace al artículo: ${link}

Título: ${String(article.title)}
Subtítulo: ${String(article.subtitle ?? "")}
Resumen:
${summary}

Reglas de estilo (obligatorias): tono profesional y editorial, como un medio serio. NADA de tono de guía, tutorial o vendedor. Máximo 1 emoji en total en todos los posts, e idealmente ninguno. Sin listas con viñetas ni "✅". Frases completas, directas, con datos del artículo.

Canales:
- x: <=280 caracteres, con gancho informativo, 1-2 hashtags máximo.
- whatsapp: 2-4 líneas sobrias y profesionales para compartir en grupos; sin emojis, sin mayúsculas de hype; termina con el enlace.
- linkedin: 3-5 párrafos cortos, tono profesional y cálido, sin emojis, cierre con invitación a leer el artículo.

Responde ÚNICAMENTE con un objeto JSON válido, sin bloques de código ni texto extra:
{"x": "post para X", "whatsapp": "mensaje para WhatsApp", "linkedin": "post para LinkedIn"}`;

      try {
        const { data, model } = await callGemini(apiKey, input, false);
        const parsed = parseJsonLoose(extractText(data));
        const posts = {
          x: String(parsed.x ?? "").trim(),
          whatsapp: String(parsed.whatsapp ?? "").trim(),
          linkedin: String(parsed.linkedin ?? "").trim(),
        };
        if (!posts.x && !posts.whatsapp && !posts.linkedin) return json({ error: "El modelo devolvió una respuesta vacía", detail: [extractText(data).slice(0, 300)] }, 502);
        return json({ posts, model });
      } catch (error) {
        return json({ error: "No se pudieron generar los posts", detail: [String(error)] }, 502);
      }
    }

    // Mode: Tellus-voice posts about a searched topic, grounded on the real
    // tweets the feed just captured. No tools: fast and quota-free.
    if (body.format === "topic_posts") {
      const query = String(body.query ?? "").trim();
      if (!query) return json({ error: "Falta query" }, 400);
      const samples = Array.isArray(body.posts)
        ? body.posts.slice(0, 10).map((p: unknown) => `- ${String(p).slice(0, 280)}`).join("\n")
        : "";
      const input = `Sos el equipo editorial de Tellus Cooperative. Tema buscado: "${query}".

Posts reales que circulan ahora en X sobre el tema:
${samples || "(sin ejemplos)"}

Escribe 3 posts LISTOS para publicar en X con la voz de Tellus: español LATAM, claros y humanos, con gancho informativo, sin hype ni tono trader, <=270 caracteres, máximo 1 hashtag, sin emojis excesivos. Aporta ángulo propio, no repitas los posts de arriba.

Responde ÚNICAMENTE con un objeto JSON válido, sin bloques de código ni texto extra:
{"posts": ["post 1", "post 2", "post 3"]}`;
      try {
        const { data, model } = await callGemini(apiKey, input, false);
        const parsed = parseJsonLoose(extractText(data));
        const posts = Array.isArray(parsed.posts) ? parsed.posts.map((p: unknown) => String(p)).filter(Boolean) : [];
        if (!posts.length) return json({ error: "El modelo devolvió una respuesta vacía" }, 502);
        return json({ posts, model });
      } catch (error) {
        return json({ error: "No se pudieron generar los posts del tema", detail: [String(error)] }, 502);
      }
    }

    // Mode: X post about a repo (from the Repos finder).
    if (body.format === "x_post") {
      if (!body.repo || typeof body.repo !== "object") return json({ error: "Falta el repositorio" }, 400);
      try {
        const draft = await generatePost(apiKey, body.repo as RepoContext);
        return json({ drafts: [draft], requested: 1, generated: 1, errors: [] });
      } catch (error) {
        return json({ error: "No se pudo generar el post", detail: [String(error)] }, 502);
      }
    }

    const count = Math.max(1, Math.min(5, Number(body.count) || 1));
    const date = typeof body.date === "string" && body.date ? body.date : yesterdayISO();

    // Prompt: explicit text wins; otherwise load the template by key (RLS-scoped).
    let promptMd = typeof body.prompt_md === "string" ? body.prompt_md.trim() : "";
    if (!promptMd) {
      const key = typeof body.prompt_key === "string" ? body.prompt_key : "crypto";
      const { data: template } = await supabase
        .from("article_prompts")
        .select("prompt_md")
        .eq("key", key)
        .maybeSingle();
      if (!template) return json({ error: `No existe la plantilla '${key}'` }, 400);
      promptMd = template.prompt_md;
    }

    // Generate sequentially: independent calls give varied drafts and keep
    // Gemini rate limits happy.
    const drafts: Draft[] = [];
    const errors: string[] = [];
    for (let i = 0; i < count; i += 1) {
      try {
        drafts.push(await generateOne(apiKey, promptMd, date));
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    if (!drafts.length) return json({ error: "No se pudo generar ningún artículo", detail: errors }, 502);
    return json({ drafts, date, requested: count, generated: drafts.length, errors });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Error de generación" }, 500);
  }
});
