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

      const deduped = [...new Map(rows.map((r) => [r.url, r])).values()];
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
    const searchResp = await fetch(`${serverUrl}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: rawQuery, count, ...(qid ? { qid } : {}) }),
    });

    const searchData = await searchResp.json();
    if (!searchResp.ok) return json({ error: searchData.error || "Error del search server" }, 502);

    const posts = (searchData.posts ?? []) as Record<string, unknown>[];
    if (!posts.length) return json({ saved: 0, posts: [], message: "Sin resultados para ese tema" });

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

    const deduped = [...new Map(rows.map((r) => [r.url, r])).values()];
    const { error } = await supabase.from("social_posts").upsert(deduped, { onConflict: "organization_id,url" });
    if (error) return json({ error: `No se pudo guardar: ${error.message}` }, 500);

    return json({ saved: deduped.length, posts: deduped });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Error" }, 500);
  }
});
