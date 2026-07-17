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

// Long-lived public web client bearer (ships in x.com's JS — not a secret).
const WEB_BEARER =
  "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

const SEARCH_FEATURES = {
  responsive_web_graphql_exclude_directive_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  creator_subscriptions_tweet_preview_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_enhance_cards_enabled: false,
  tweetypie_unmention_optimization_enabled: true,
  view_counts_everywhere_api_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
};

function num(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

interface Row {
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

function parseSearch(data: Record<string, unknown>, orgId: string, max: number): Row[] {
  const rows: Row[] = [];
  const instructions =
    ((((data.data as Record<string, unknown>)?.search_by_raw_query as Record<string, unknown>)
      ?.search_timeline as Record<string, unknown>)?.timeline as Record<string, unknown>)
      ?.instructions as Record<string, unknown>[] ?? [];
  for (const instruction of instructions) {
    for (const entry of (instruction.entries as Record<string, unknown>[]) ?? []) {
      if (!String((entry as Record<string, unknown>).entryId ?? "").startsWith("tweet-")) continue;
      const content = (entry as Record<string, unknown>).content as Record<string, unknown>;
      let result = ((content?.itemContent as Record<string, unknown>)?.tweet_results as Record<string, unknown>)?.result as Record<string, unknown>;
      if (!result) continue;
      if (result.__typename === "TweetWithVisibilityResults") result = result.tweet as Record<string, unknown>;
      const legacy = result.legacy as Record<string, unknown>;
      if (!legacy || legacy.retweeted_status_result) continue;
      const core = ((result.core as Record<string, unknown>)?.user_results as Record<string, unknown>)?.result as Record<string, unknown>;
      const handle = String((core?.legacy as Record<string, unknown>)?.screen_name ?? (core?.core as Record<string, unknown>)?.screen_name ?? "");
      if (!handle) continue;
      const note = ((result.note_tweet as Record<string, unknown>)?.note_tweet_results as Record<string, unknown>)?.result as Record<string, unknown>;
      const idStr = String(legacy.id_str ?? "");
      rows.push({
        organization_id: orgId,
        account_id: null,
        platform: "x",
        author_handle: handle,
        url: `https://x.com/${handle}/status/${idStr}`,
        content: String((note?.text as string) ?? legacy.full_text ?? "").trim(),
        posted_at: legacy.created_at ? new Date(String(legacy.created_at)).toISOString() : null,
        likes: num(legacy.favorite_count),
        reposts: num(legacy.retweet_count),
        replies: num(legacy.reply_count),
        views: num((result.views as Record<string, unknown>)?.count),
        source: "scraper",
      });
      if (rows.length >= max) return rows;
    }
  }
  return rows;
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

    const authToken = Deno.env.get("X_SCRAPER_AUTH_TOKEN");
    const ct0 = Deno.env.get("X_SCRAPER_CT0");
    const queryId = Deno.env.get("X_QID_SEARCH");
    if (!authToken || !ct0) return json({ error: "Faltan las cookies de X (X_SCRAPER_AUTH_TOKEN / X_SCRAPER_CT0)" }, 503);
    if (!queryId) return json({ error: "Falta el queryId de búsqueda de X (X_QID_SEARCH)" }, 503);

    const body = await request.json();
    const rawQuery = String(body.query ?? "").trim();
    if (!rawQuery) return json({ error: "Falta el tema a buscar" }, 400);
    const count = Math.max(1, Math.min(40, Number(body.count) || 20));

    const variables = { rawQuery, count, querySource: "typed_query", product: "Latest" };
    const url = `https://x.com/i/api/graphql/${queryId}/SearchTimeline`
      + `?variables=${encodeURIComponent(JSON.stringify(variables))}`
      + `&features=${encodeURIComponent(JSON.stringify(SEARCH_FEATURES))}`;

    const xResponse = await fetch(url, {
      headers: {
        authorization: WEB_BEARER,
        "x-csrf-token": ct0,
        cookie: `auth_token=${authToken}; ct0=${ct0}`,
        "x-twitter-active-user": "yes",
        "x-twitter-auth-type": "OAuth2Session",
        "content-type": "application/json",
      },
    });
    if (xResponse.status === 404) return json({ error: "queryId de búsqueda vencido — actualizá X_QID_SEARCH" }, 502);
    if (xResponse.status === 401 || xResponse.status === 403) return json({ error: "X rechazó las cookies — actualizá auth_token/ct0" }, 502);
    if (!xResponse.ok) return json({ error: `X respondió ${xResponse.status}` }, 502);

    const data = await xResponse.json();
    const rows = parseSearch(data, membership.organization_id, count);
    if (!rows.length) return json({ saved: 0, posts: [], message: "Sin resultados para ese tema" });

    // Upsert as the authenticated user (RLS lets non-viewers write).
    const deduped = [...new Map(rows.map((r) => [r.url, r])).values()];
    const { error } = await supabase.from("social_posts").upsert(deduped, { onConflict: "organization_id,url" });
    if (error) return json({ error: `No se pudo guardar: ${error.message}` }, 500);

    return json({ saved: deduped.length, posts: deduped });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Error de búsqueda" }, 500);
  }
});
