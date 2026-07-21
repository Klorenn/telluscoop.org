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

function num(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

interface PostRow {
  organization_id: string;
  account_id: null;
  platform: "x";
  author_handle: string;
  url: string;
  content: string;
  posted_at: string | null;
  likes: number;
  reposts: number;
  replies: number;
  views: number;
  source: "scraper";
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
      .select("role, organization_id")
      .neq("role", "viewer")
      .maybeSingle();
    if (!membership) return json({ error: "Solo el equipo puede buscar temas" }, 403);

    const body = await request.json();

    // Re-running the same (or an overlapping) search keeps finding the same
    // trending tweets, which cluttered the feed and made "Comentarios del
    // día" regenerate replies for posts already captured. Drop anything
    // whose URL is already in social_posts before it's saved or returned.
    const dropAlreadyCaptured = async (rows: PostRow[]): Promise<PostRow[]> => {
      const urls = rows.map((r) => r.url).filter(Boolean);
      if (!urls.length) return rows;
      const { data: existing } = await supabase
        .from("social_posts")
        .select("url")
        .eq("organization_id", membership.organization_id)
        .in("url", urls);
      const seen = new Set((existing || []).map((r: { url: string }) => r.url));
      return rows.filter((r) => !seen.has(r.url));
    };

    // Mode 1: Client sends pre-parsed posts directly
    if (Array.isArray(body.posts)) {
      const rows: PostRow[] = body.posts.map((p: Record<string, unknown>) => ({
        organization_id: membership.organization_id,
        account_id: null,
        platform: "x" as const,
        author_handle: String(p.author_handle ?? ""),
        url: String(p.url ?? ""),
        content: String(p.content ?? ""),
        posted_at: p.posted_at ? new Date(String(p.posted_at)).toISOString() : null,
        likes: num(p.likes),
        reposts: num(p.reposts),
        replies: num(p.replies),
        views: num(p.views),
        source: "scraper" as const,
      })).filter((r: PostRow) => r.author_handle && r.url);

      if (!rows.length) return json({ saved: 0, posts: [], message: "Sin resultados válidos" });

      const deduped = await dropAlreadyCaptured([...new Map(rows.map((r) => [r.url, r])).values()]);
      if (!deduped.length) return json({ saved: 0, posts: [], message: "Ya tenías todos estos posts capturados." });
      const { error } = await supabase.from("social_posts").upsert(deduped, { onConflict: "organization_id,url" });
      if (error) return json({ error: `No se pudo guardar: ${error.message}` }, 500);

      return json({ saved: deduped.length, posts: deduped });
    }

    // Mode 2: Call Render Playwright server
    const serverUrl = Deno.env.get("X_SEARCH_SERVER_URL");
    const rawQuery = String(body.query ?? "").trim();
    const qid = String(body.qid ?? "").trim();
    const count = Math.max(1, Math.min(40, Number(body.count) || 20));

    if (!rawQuery) return json({ error: "Falta query o posts" }, 400);
    if (!serverUrl) return json({ error: "X_SEARCH_SERVER_URL no configurado" }, 503);

    // qid is optional: the search server sniffs the current one from the page.
    // The Render free instance sleeps and can OOM, so cap the wait and fall
    // back to a Gemini google_search pass when the scraper is unavailable.
    const callServer = async () => {
      const response = await fetch(`${serverUrl}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: rawQuery, count, ...(qid ? { qid } : {}) }),
        signal: AbortSignal.timeout(95000),
      }).catch(() => null);
      if (!response) return null;
      const text = await response.text();
      try {
        return JSON.parse(text) as Record<string, unknown>;
      } catch {
        return null;
      }
    };

    let via = "scraper";
    let message = "";
    let posts: Record<string, unknown>[] = [];
    const searchData = await callServer();

    if (searchData && Array.isArray(searchData.posts)) {
      posts = searchData.posts as Record<string, unknown>[];
      if (!posts.length) return json({ saved: 0, posts: [], message: "Sin resultados para ese tema" });
    } else {
      posts = await geminiFallback(rawQuery);
      via = "google";
      message = "El scraper de X estaba dormido: resultados vía Google (sin métricas). Reintentá en 1-2 min para datos completos.";
      if (!posts.length) {
        return json({ error: (searchData?.error as string) || "El buscador de X no respondió y el fallback no encontró posts. Probá de nuevo en 1-2 minutos." }, 502);
      }
    }

    const rows: PostRow[] = posts.map((p) => ({
      organization_id: membership.organization_id,
      account_id: null,
      platform: "x" as const,
      author_handle: String(p.author_handle ?? ""),
      url: String(p.url ?? ""),
      content: String(p.content ?? ""),
      posted_at: p.posted_at ? new Date(String(p.posted_at)).toISOString() : null,
      likes: num(p.likes),
      reposts: num(p.reposts),
      replies: num(p.replies),
      views: num(p.views),
      source: "scraper" as const,
    })).filter((r) => r.author_handle && r.url);

    const deduped = await dropAlreadyCaptured([...new Map(rows.map((r) => [r.url, r])).values()]);
    if (!deduped.length) return json({ saved: 0, posts: [], message: "Ya tenías todos estos posts capturados — probá otro tema." });
    const { error } = await supabase.from("social_posts").upsert(deduped, { onConflict: "organization_id,url" });
    if (error) return json({ error: `No se pudo guardar: ${error.message}` }, 500);

    return json({ saved: deduped.length, posts: deduped, via, ...(message ? { message } : {}) });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Error" }, 500);
  }
});

// Last resort when the Playwright scraper is asleep/dead: ask Gemini to find
// recent X posts about the topic via Google Search. No engagement metrics, but
// the feed keeps working.
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

async function geminiFallback(query: string): Promise<Record<string, unknown>[]> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return [];
  try {
    const input = `Busca con Google posts recientes de X (Twitter) sobre "${query}" (probá "site:x.com ${query}" y variantes). Solo posts reales que encuentres, con su URL exacta de x.com.

Responde ÚNICAMENTE con un objeto JSON válido, sin bloques de código ni texto extra:
{"posts": [{"author_handle": "usuario sin @", "url": "https://x.com/usuario/status/...", "content": "texto del post"}]}`;
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
    const posts = Array.isArray(parsed.posts) ? parsed.posts as Record<string, unknown>[] : [];
    return posts.filter((p) => /^https:\/\/(x|twitter)\.com\/[^/]+\/status\/\d+/.test(String(p.url ?? "")));
  } catch {
    return [];
  }
}
