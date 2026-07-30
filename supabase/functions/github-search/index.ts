import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Authenticated proxy to the GitHub API. The token stays server-side
// (GITHUB_TOKEN Supabase secret) — the browser never sees it. Falls back to
// unauthenticated calls if the secret isn't set yet (60 req/hr instead of
// 5000/hr), so nothing breaks before the secret is configured.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

function ghHeaders(): Record<string, string> {
  const token = Deno.env.get("GITHUB_TOKEN");
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "tellus-social-ops",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Canonical repo record used to verify content before an article/post is
// generated: owner, archived state, license, activity — every field the
// technical-control checklist needs.
function repoFicha(repo: Record<string, unknown>) {
  return {
    full_name: String(repo.full_name ?? ""),
    html_url: String(repo.html_url ?? ""),
    description: repo.description ?? null,
    owner_login: (repo.owner as Record<string, unknown> | undefined)?.login ?? null,
    owner_type: (repo.owner as Record<string, unknown> | undefined)?.type ?? null,
    archived: repo.archived === true,
    disabled: repo.disabled === true,
    fork: repo.fork === true,
    license: (repo.license as Record<string, unknown> | undefined)?.spdx_id ?? null,
    default_branch: repo.default_branch ?? null,
    language: repo.language ?? null,
    stargazers_count: Number(repo.stargazers_count) || 0,
    forks_count: Number(repo.forks_count) || 0,
    pushed_at: repo.pushed_at ?? null,
    created_at: repo.created_at ?? null,
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    verified_at: new Date().toISOString().slice(0, 10),
  };
}

async function fetchRepo(fullName: string) {
  const response = await fetch(`https://api.github.com/repos/${fullName}`, { headers: ghHeaders() });
  if (!response.ok) return null;
  return repoFicha(await response.json());
}

async function fetchLatestRelease(fullName: string) {
  const response = await fetch(`https://api.github.com/repos/${fullName}/releases/latest`, { headers: ghHeaders() });
  if (!response.ok) return null;
  const release = await response.json();
  return { tag_name: release.tag_name ?? null, published_at: release.published_at ?? null, html_url: release.html_url ?? null };
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
    if (!membership) return json({ error: "Solo el equipo puede buscar en GitHub" }, 403);

    const body = await request.json();
    const op = String(body.op ?? "search");

    if (op === "search") {
      const query = String(body.query ?? "").trim();
      if (!query) return json({ error: "Falta query" }, 400);
      const perPage = Math.max(1, Math.min(50, Number(body.perPage) || 20));
      const sort = String(body.sort ?? "stars");
      const sortParam = sort === "best" ? "" : `&sort=${sort}&order=desc`;
      const response = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}${sortParam}&per_page=${perPage}`,
        { headers: ghHeaders() },
      ).catch(() => null);
      if (!response?.ok) return json({ ok: false, items: [] });
      const data = await response.json();
      return json({ ok: true, items: Array.isArray(data.items) ? data.items : [] });
    }

    if (op === "repo") {
      const fullName = String(body.full_name ?? "").trim();
      if (!fullName) return json({ error: "Falta full_name" }, 400);
      const repo = await fetchRepo(fullName);
      if (!repo) return json({ repo: null });
      return json({ repo });
    }

    if (op === "batch_repo") {
      const names = Array.isArray(body.full_names) ? body.full_names.slice(0, 20).map((n: unknown) => String(n)) : [];
      const repos = (await Promise.all(names.map(fetchRepo))).filter((r) => r !== null);
      return json({ repos });
    }

    // Verified ficha for the technical-control checklist: repo record + the
    // latest release, so callers can refuse to write about archived repos or
    // invent a version that doesn't exist.
    if (op === "verify") {
      const fullName = String(body.full_name ?? "").trim();
      if (!fullName) return json({ error: "Falta full_name" }, 400);
      const repo = await fetchRepo(fullName);
      if (!repo) return json({ repo: null, release: null });
      const release = await fetchLatestRelease(fullName);
      return json({ repo, release });
    }

    return json({ error: `Operación desconocida: ${op}` }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Error" }, 500);
  }
});
