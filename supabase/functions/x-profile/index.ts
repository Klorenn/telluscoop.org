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

const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

// "12.3K" | "1,234" | "1.2M" → integer.
function parseCompact(raw: string): number | null {
  const m = raw.trim().match(/^([\d.,]+)\s*([KM])?$/i);
  if (!m) return null;
  let n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  if (m[2]?.toUpperCase() === "K") n *= 1e3;
  if (m[2]?.toUpperCase() === "M") n *= 1e6;
  return Math.floor(n);
}

// Instagram serves the follower count in the og:description meta tag of the
// public profile page, no login needed: "1,234 Followers, 56 Following, …".
async function igFollowers(handle: string): Promise<number | null> {
  try {
    const res = await fetch(`https://www.instagram.com/${handle}/`, {
      headers: { "User-Agent": BROWSER_UA, "Accept-Language": "en" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const meta = html.match(/property="og:description"\s+content="([^"]+)"/)?.[1]
      ?? html.match(/content="([^"]+)"\s+property="og:description"/)?.[1] ?? "";
    const m = meta.match(/([\d.,]+[KM]?)\s+Followers/i) ?? html.match(/"edge_followed_by":\{"count":(\d+)\}/);
    return m ? parseCompact(m[1]) : null;
  } catch {
    return null;
  }
}

// LinkedIn company pages expose "N followers" in the meta description for
// crawlers. Often behind an authwall for plain fetches — best-effort only,
// manual entry stays as the fallback.
async function liFollowers(slug: string): Promise<number | null> {
  try {
    const res = await fetch(`https://www.linkedin.com/company/${slug}`, {
      headers: { "User-Agent": BROWSER_UA, "Accept-Language": "en" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/([\d.,]+[KM]?)\s+followers/i);
    return m ? parseCompact(m[1]) : null;
  } catch {
    return null;
  }
}

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

    // The cron always refreshes everything; the button sends refresh: "all"
    // too. Failures are per-platform: one account failing to resolve must not
    // block the others, so errors are collected instead of returned early.
    const refreshAll = isCron || body.refresh === "all";
    const errors: string[] = [];
    const saveMetric = async (platform: string, followers: number | null) => {
      if (followers === null || followers <= 0) return null;
      const { error } = await db.from("social_metrics").insert({
        organization_id: organizationId,
        platform,
        followers,
        source: "scraper",
      });
      if (error) { errors.push(`${platform}: ${error.message}`); return null; }
      return followers;
    };

    // Own account handles per platform (category tellus-own).
    const { data: ownAccounts } = await db
      .from("social_accounts")
      .select("id, platform, handle")
      .eq("organization_id", organizationId)
      .eq("category", "tellus-own");
    const own = (p: string) => (ownAccounts || []).find((a: { platform: string }) => a.platform === p);

    // --- X (Playwright server) ---
    let xFollowers: number | null = null;
    let latestPost: { url?: string; posted_at?: string } | null = null;
    const serverUrl = Deno.env.get("X_SEARCH_SERVER_URL");
    if (!serverUrl) {
      errors.push("x: X_SEARCH_SERVER_URL no configurado");
    } else {
      const response = await fetch(`${serverUrl}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
        signal: AbortSignal.timeout(95000),
      }).catch(() => null);
      if (!response) {
        errors.push("x: el servidor no respondió (puede estar dormido, reintentá en 1-2 min)");
      } else {
        try {
          const data = JSON.parse(await response.text()) as Record<string, unknown>;
          if (!response.ok) {
            errors.push(`x: ${(data.error as string) || "no se pudo leer el perfil"}`);
          } else {
            const n = Number(data.followers);
            xFollowers = await saveMetric("x", Number.isFinite(n) && n > 0 ? Math.floor(n) : null);
            latestPost = (data.latest_post as typeof latestPost) ?? null;
          }
        } catch {
          errors.push("x: respuesta inválida del servidor");
        }
      }
    }

    if (latestPost?.url && latestPost.posted_at) {
      const { error } = await db.from("social_posts").upsert({
        organization_id: organizationId,
        account_id: own("x")?.id ?? null,
        platform: "x",
        author_handle: handle,
        url: latestPost.url,
        content: "(post propio, detectado por el scraper de perfil)",
        posted_at: latestPost.posted_at,
        source: "scraper",
      }, { onConflict: "organization_id,url" });
      if (error) errors.push(`x post: ${error.message}`);
    }

    // --- Instagram + LinkedIn (public meta tags, best-effort) ---
    let igCount: number | null = null;
    let liCount: number | null = null;
    if (refreshAll) {
      const igHandle = own("instagram")?.handle;
      const liSlug = own("linkedin")?.handle;
      const [ig, li] = await Promise.all([
        igHandle ? igFollowers(igHandle) : Promise.resolve(null),
        liSlug ? liFollowers(liSlug) : Promise.resolve(null),
      ]);
      igCount = await saveMetric("instagram", ig);
      liCount = await saveMetric("linkedin", li);
      if (igHandle && ig === null) errors.push("instagram: no se pudo leer el perfil público");
      if (liSlug && li === null) errors.push("linkedin: página protegida, cargá el número a mano");
    }

    // Only fail hard when literally nothing worked.
    if (xFollowers === null && igCount === null && liCount === null && !latestPost) {
      return json({ error: `No se pudo actualizar ninguna cuenta. ${errors.join(" · ")}` }, 502);
    }

    return json({ x: xFollowers, instagram: igCount, linkedin: liCount, latest_post: latestPost ?? null, ...(errors.length ? { warnings: errors } : {}) });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Error" }, 500);
  }
});
