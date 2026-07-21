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
    if (!membership) return json({ error: "Solo el equipo puede actualizar el resumen" }, 403);

    const body = await request.json();
    const handle = String(body.handle ?? "telluscoop").replace(/^@/, "").trim();

    const serverUrl = Deno.env.get("X_SEARCH_SERVER_URL");
    if (!serverUrl) return json({ error: "X_SEARCH_SERVER_URL no configurado" }, 503);

    const response = await fetch(`${serverUrl}/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle }),
      signal: AbortSignal.timeout(95000),
    }).catch(() => null);
    if (!response) return json({ error: "El servidor de X no respondió. Puede estar dormido, reintentá en 1-2 min." }, 502);

    const text = await response.text();
    let data: Record<string, unknown>;
    try { data = JSON.parse(text); } catch { return json({ error: "Respuesta inválida del servidor de X" }, 502); }
    if (!response.ok) return json({ error: (data.error as string) || "No se pudo leer el perfil de X" }, 502);

    const followers = Number(data.followers);
    const latestPost = data.latest_post as { url?: string; posted_at?: string } | null;

    if (Number.isFinite(followers) && followers > 0) {
      const { error } = await supabase.from("social_metrics").insert({
        organization_id: membership.organization_id,
        platform: "x",
        followers: Math.floor(followers),
        source: "scraper",
      });
      if (error) return json({ error: `No se pudo guardar seguidores: ${error.message}` }, 500);
    }

    if (latestPost?.url && latestPost.posted_at) {
      const { data: account } = await supabase
        .from("social_accounts")
        .select("id")
        .eq("organization_id", membership.organization_id)
        .eq("platform", "x")
        .eq("handle", handle)
        .maybeSingle();

      const { error } = await supabase.from("social_posts").upsert({
        organization_id: membership.organization_id,
        account_id: account?.id ?? null,
        platform: "x",
        author_handle: handle,
        url: latestPost.url,
        content: "(post propio, detectado por el scraper de perfil)",
        posted_at: latestPost.posted_at,
        source: "scraper",
      }, { onConflict: "organization_id,url" });
      if (error) return json({ error: `No se pudo guardar el post: ${error.message}` }, 500);
    }

    return json({ followers: Number.isFinite(followers) && followers > 0 ? Math.floor(followers) : null, latest_post: latestPost ?? null });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Error" }, 500);
  }
});
