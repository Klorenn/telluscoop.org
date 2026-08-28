import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PASSPORT_API_BASE = "https://demo.stellarpassport.xyz/api/v1";
const TIERLY_ORG_SLUG = "stellar-chile";

const ALLOWED_ORIGINS = ["https://telluscoop.org", "https://www.telluscoop.org"];
const LOCAL_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1):\d+$/;
const PASSPORT_PUBLIC_BASE = "https://demo.stellarpassport.xyz";

const isAllowedOrigin = (origin: string | null) =>
  Boolean(origin && (ALLOWED_ORIGINS.includes(origin) || LOCAL_ORIGIN.test(origin)));

const corsFor = (origin: string | null) => ({
  "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin! : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  Vary: "Origin",
});

async function passport(path: string, key: string) {
  const response = await fetch(`${PASSPORT_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (response.status === 429) throw new Error("rate_limited");
  if (!response.ok) throw new Error(`passport_${response.status}`);
  return response.json();
}

async function publicPassport(path: string) {
  const response = await fetch(`${PASSPORT_PUBLIC_BASE}${path}`);
  if (!response.ok) throw new Error(`passport_${response.status}`);
  return response.json();
}

export async function searchBuilders(passport, key, query, publicLookup = null) {
  const matches = [];
  const normalizedQuery = query.trim().toLowerCase();
  const directUsername = query.trim();
  if (!directUsername) return matches;

  const directVariants = [...new Set([
    directUsername,
    directUsername.toLowerCase(),
    directUsername.charAt(0).toUpperCase() + directUsername.slice(1).toLowerCase(),
  ])];
  for (const username of directVariants) {
    try {
      const direct = await passport(`/builders/${encodeURIComponent(username)}`, key);
      const builder = direct?.data && !Array.isArray(direct.data) ? direct.data : direct;
      if (builder && !Array.isArray(builder) && typeof builder === "object" && builder.username) return [builder];
    } catch (error) {
      if (!(error instanceof Error && error.message === "passport_404")) throw error;
      if (publicLookup) {
        try {
          const publicResponse = await publicLookup(`/api/builder/public/${encodeURIComponent(username)}`);
          const source = publicResponse?.builder || publicResponse?.data || publicResponse;
          const builder = source && typeof source === "object" ? { ...source } : source;
          if (builder && !builder.username && builder.github_username) builder.username = builder.github_username;
          if (builder && !builder.name) builder.name = builder.display_name || builder.full_name || builder.username;
          const builderAvatar = builder && (builder.avatar_url || builder.avatar || builder.image);
          if (builder && !builder.logo_url && builderAvatar) builder.logo_url = builderAvatar;
          if (builder?.username) return [builder];
        } catch (publicError) {
          if (!(publicError instanceof Error && publicError.message === "passport_404")) throw publicError;
        }
      }
    }
  }

  const seenBuilders = new Set(matches.map((builder) => String(builder.username || "").toLowerCase()).filter(Boolean));
  const pageSize = 100;
  const seenPages = new Set();
  const maxPages = 100;

  for (let page = 0; page < maxPages && matches.length < 20; page++) {
    let res;
    try {
      res = await passport(`/builders?limit=${pageSize}&offset=${page * pageSize}`, key);
    } catch (error) {
      if (error instanceof Error && error.message === "passport_404") break;
      throw error;
    }
    const items = res.data || [];
    const pageSignature = JSON.stringify(items);
    if (seenPages.has(pageSignature)) break;
    seenPages.add(pageSignature);

    const total = typeof res.total === "number" ? res.total : null;
    for (const builder of items) {
      if ((builder.name || "").toLowerCase().includes(normalizedQuery) || (builder.username || "").toLowerCase().includes(normalizedQuery)) {
        const username = String(builder.username || "").toLowerCase();
        if (!username || !seenBuilders.has(username)) {
          matches.push(builder);
          if (username) seenBuilders.add(username);
        }
        if (matches.length >= 20) break;
      }
    }
    if (items.length < pageSize || (total !== null && (page + 1) * pageSize >= total)) break;
  }
  return matches;
}

export function normalizeBuilderResponse(response) {
  const builder = response?.builder && typeof response.builder === "object"
    ? response.builder
    : response?.data && !Array.isArray(response.data) ? response.data : response;
  if (!builder || typeof builder !== "object" || Array.isArray(builder)) return builder;
  const normalized = { ...builder };
  const username = normalized.username || normalized.github_username;
  const name = normalized.name || normalized.display_name || normalized.full_name || username;
  const displayName = normalized.display_name;
  const avatar = normalized.avatar_url || normalized.avatar || normalized.image || normalized.logo_url;
  if (username) normalized.username = username;
  if (name) normalized.name = name;
  if (displayName) normalized.display_name = displayName;
  if (avatar) {
    normalized.avatar_url = avatar;
    normalized.logo_url = avatar;
  }
  const description = normalized.description || normalized.bio;
  if (description) normalized.description = description;
  const website = normalized.website || normalized.website_url;
  if (website) normalized.website = website;
  return normalized;
}

Deno.serve(async (request) => {
  const cors = corsFor(request.headers.get("Origin"));
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "GET") return json({ error: "Método no permitido" }, 405);

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

    const key = Deno.env.get("STELLAR_PASSPORT_API_KEY");
    if (!key) return json({ error: "Stellar Passport todavía no está configurado" }, 503);

    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action === "builders") {
      const query = (url.searchParams.get("q") || "").trim();
      if (query.length < 2) return json({ builders: [] });

      // Passport's /builders endpoint has no text-search param — page through
      // results ourselves and match on name/username, capped to stay within
      // the 100 req/min rate limit.
      const matches = await searchBuilders(passport, key, query, publicPassport);
      return json({ builders: matches });
    }

    if (action === "profile") {
      const username = url.searchParams.get("username");
      if (!username) return json({ error: "Falta username" }, 400);
      let response;
      try {
        response = await passport(`/builders/${encodeURIComponent(username)}`, key);
      } catch (error) {
        if (!(error instanceof Error && error.message === "passport_404")) throw error;
        response = await publicPassport(`/api/builder/public/${encodeURIComponent(username)}`);
      }
      const builder = normalizeBuilderResponse(response);
      const stats = response?.stats || response?.data?.stats || builder?.stats;
      const projects = Array.isArray(response?.projects) ? response.projects : [];
      const projectCount = Array.isArray(response?.projects) ? response.projects.length : undefined;
      const topRepos = projects
        .flatMap((project) => (Array.isArray(project.repos) ? project.repos : []))
        .slice(0, 2)
        .map((repo) => ({
          full_name: repo.full_name,
          html_url: repo.html_url,
          stars: repo.stars,
          primary_language: repo.primary_language,
        }));
      return json({
        builder,
        ...(stats ? { stats } : {}),
        ...(projectCount !== undefined ? { project_count: projectCount } : {}),
        ...(topRepos.length ? { top_repos: topRepos } : {}),
      });
    }

    if (action === "events") {
      const [tierlyEvents, allEvents] = await Promise.all([
        passport(`/events?org=${encodeURIComponent(TIERLY_ORG_SLUG)}`, key),
        passport(`/events`, key),
      ]);
      const tierlyIds = new Set((tierlyEvents.data || []).map((event: { id: string }) => event.id));
      const otherEvents = (allEvents.data || []).filter((event: { id: string }) => !tierlyIds.has(event.id));
      return json({ tierly_events: tierlyEvents.data || [], other_events: otherEvents });
    }

    return json({ error: "Acción inválida" }, 400);
  } catch (error) {
    if (error instanceof Error && error.message === "rate_limited") {
      return json({ error: "Límite de la API de Passport alcanzado, probá de nuevo en un rato" }, 429);
    }
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Error consultando Passport" }, 500);
  }
});
