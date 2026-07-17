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

const MODEL = "gemini-3.5-flash";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

// Structured shape we force the model to return per article.
const ARTICLE_SCHEMA = {
  type: "object",
  properties: {
    titulo: { type: "string", description: "Título SEO, 5-6 palabras, con el tema central del día" },
    subtitulo: { type: "string", description: "1 frase que resume los 2-3 hechos clave" },
    resumen: { type: "array", items: { type: "string" }, description: "3 a 5 bullets: qué pasó y por qué importa" },
    cuerpo_md: { type: "string", description: "Desarrollo + En foco + Cierre Tellus, en Markdown con subtítulos" },
  },
  required: ["titulo", "subtitulo", "resumen", "cuerpo_md"],
};

// Short X post about a repo, Tellus voice.
const POST_SCHEMA = {
  type: "object",
  properties: {
    post: { type: "string", description: "Post principal para X en español LATAM, <=280 caracteres, con gancho y el enlace del repo" },
    thread: { type: "array", items: { type: "string" }, description: "0-3 tweets extra de hilo, opcionales" },
    hashtags: { type: "array", items: { type: "string" }, description: "2-4 hashtags relevantes sin espacios" },
  },
  required: ["post"],
};

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
  const input = `${promptMd}\n\nResume lo ocurrido el día anterior: ${date}. Usa Google Search para verificar cada hecho y cita fuentes reales y recientes. Fecha de publicación: hoy.`;

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      input,
      tools: [{ type: "google_search" }, { type: "url_context" }],
      response_format: { type: "text", mime_type: "application/json", schema: ARTICLE_SCHEMA },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini ${response.status}: ${detail.slice(0, 300)}`);
  }

  const data = await response.json();
  const parsed = JSON.parse(data.output_text ?? "{}");

  return {
    title: String(parsed.titulo ?? "").trim(),
    subtitle: String(parsed.subtitulo ?? "").trim(),
    summary: Array.isArray(parsed.resumen) ? parsed.resumen.map((s: unknown) => String(s)) : [],
    body_md: String(parsed.cuerpo_md ?? "").trim(),
    sources: collectSources(data),
    model: MODEL,
  };
}

async function generatePost(apiKey: string, repo: RepoContext): Promise<Draft> {
  const input = `Escribe un post para X (Twitter) en español LATAM con la voz editorial de Tellus Cooperative sobre este repositorio de GitHub.

Repositorio: ${repo.full_name ?? ""}
Descripción: ${repo.description ?? ""}
Lenguaje: ${repo.language ?? ""}
Estrellas: ${repo.stars ?? ""}
Enlace: ${repo.url ?? ""}

Usa Google Search para entender qué hace el proyecto y por qué es interesante. El post principal debe tener gancho, ser claro y humano (sin hype ni tono trader), explicar en una línea por qué importa, e incluir el enlace del repo. Opcionalmente agrega 1-3 tweets de hilo con más detalle. Nada de emojis excesivos.`;

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      input,
      tools: [{ type: "google_search" }, { type: "url_context" }],
      response_format: { type: "text", mime_type: "application/json", schema: POST_SCHEMA },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini ${response.status}: ${detail.slice(0, 300)}`);
  }

  const data = await response.json();
  const parsed = JSON.parse(data.output_text ?? "{}");
  const thread = Array.isArray(parsed.thread) ? parsed.thread.map((t: unknown) => String(t)) : [];
  const hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.map((h: unknown) => String(h)) : [];
  const body = [String(parsed.post ?? "").trim(), ...thread].filter(Boolean).join("\n\n");

  return {
    title: repo.full_name ?? "Post para X",
    subtitle: repo.description ?? "",
    summary: hashtags,
    body_md: body,
    sources: collectSources(data),
    model: MODEL,
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
    if (!apiKey) return json({ error: "Gemini todavía no está configurado" }, 503);

    const body = await request.json();

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
