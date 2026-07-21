import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

interface RepoMeta {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  pushed_at: string | null;
  topics: string[];
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
      .neq("role", "viewer")
      .maybeSingle();
    if (!membership) return json({ error: "Solo el equipo puede buscar repos" }, 403);

    const body = await request.json();
    const query = String(body.query ?? "").trim();
    if (!query) return json({ error: "Falta query" }, 400);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ repos: [] });

    const candidates = await findRepoCandidates(query, apiKey);
    const repos = (await Promise.all(candidates.slice(0, 8).map(fetchRepoMeta))).filter((r): r is RepoMeta => r !== null);

    return json({ repos });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Error" }, 500);
  }
});

// Finds GitHub repos being discussed around the query (blogs, X, Reddit, forums)
// via Gemini + Google Search grounding, so the picker isn't limited to what
// GitHub's own search API happens to match on name/description.
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

async function findRepoCandidates(query: string, apiKey: string): Promise<string[]> {
  try {
    const input = `Busca en Google qué repositorios de GitHub se mencionan o discuten en relación a "${query}" (blogs, X/Twitter, Reddit, Hacker News, foros técnicos). Solo repos reales y que existan hoy en github.com, sin inventar.

Responde ÚNICAMENTE con un objeto JSON válido, sin bloques de código ni texto extra:
{"repos": [{"full_name": "owner/repo"}]}`;
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gemini-2.5-flash", input, tools: [{ type: "google_search" }] }),
    });
    if (!response.ok) return [];
    const data = await response.json() as Record<string, unknown>;
    if (data.error) return [];
    const text = extractText(data).replace(/```json|```/g, "").trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) return [];
    const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const repos = Array.isArray(parsed.repos) ? parsed.repos as Record<string, unknown>[] : [];
    const names = repos.map((r) => String(r.full_name ?? "").trim()).filter((n) => /^[\w.-]+\/[\w.-]+$/.test(n));
    return [...new Set(names)];
  } catch {
    return [];
  }
}

async function fetchRepoMeta(fullName: string): Promise<RepoMeta | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${fullName}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "tellus-social-ops" },
    });
    if (!response.ok) return null;
    const repo = await response.json();
    return {
      full_name: repo.full_name,
      html_url: repo.html_url,
      description: repo.description ?? null,
      stargazers_count: Number(repo.stargazers_count) || 0,
      language: repo.language ?? null,
      pushed_at: repo.pushed_at ?? null,
      topics: Array.isArray(repo.topics) ? repo.topics : [],
    };
  } catch {
    return null;
  }
}
