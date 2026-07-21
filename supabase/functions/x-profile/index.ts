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

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const isCron = !!serviceRoleKey && authorization === `Bearer ${serviceRoleKey}`;

    let db: ReturnType<typeof createClient>;
    let organizationId: string;

    if (isCron) {
      // Trusted server-to-server call from the daily pg_cron job — no
      // interactive user, so resolve the org directly and use the
      // service-role client (RLS requires auth.uid(), which a cron job has none of).
      db = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey!);
      const { data: org } = await db.from("organizations").select("id").eq("slug", "tellus").maybeSingle();
      if (!org) return json({ error: "Organización no encontrada" }, 500);
      organizationId = org.id;
    } else {
      db = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authorization } } },
      );
      const { data: { user }, error: userError } = await db.auth.getUser();
      if (userError || !user) return json({ error: "Sesión inválida" }, 401);

      const { data: membership } = await db
        .from("organization_members")
        .select("role, organization_id")
        .neq("role", "viewer")
        .maybeSingle();
      if (!membership) return json({ error: "Solo el equipo puede actualizar el resumen" }, 403);
      organizationId = membership.organization_id as string;
    }

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
      const { error } = await db.from("social_metrics").insert({
        organization_id: organizationId,
        platform: "x",
        followers: Math.floor(followers),
        source: "scraper",
      });
      if (error) return json({ error: `No se pudo guardar seguidores: ${error.message}` }, 500);
    }

    if (latestPost?.url && latestPost.posted_at) {
      const { data: account } = await db
        .from("social_accounts")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("platform", "x")
        .eq("handle", handle)
        .maybeSingle();

      const { error } = await db.from("social_posts").upsert({
        organization_id: organizationId,
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
