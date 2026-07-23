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

interface XUser {
  handle: string;
  name: string;
  bio: string;
  followers: number;
  url: string;
}

async function fetchList(serverUrl: string, handle: string, list: "followers" | "following"): Promise<XUser[] | { error: string }> {
  const response = await fetch(`${serverUrl}/follow-list`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle, list, count: 400 }),
    signal: AbortSignal.timeout(120000),
  }).catch(() => null);
  if (!response) return { error: "El servidor de X no respondió. Puede estar dormido, reintentá en 1-2 min." };
  try {
    const data = JSON.parse(await response.text());
    if (!response.ok) return { error: (data.error as string) || "No se pudo leer la lista" };
    return (data.users ?? []) as XUser[];
  } catch {
    return { error: "Respuesta inválida del servidor de X" };
  }
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
    if (!membership) return json({ error: "Solo el equipo puede ver seguidores" }, 403);

    const serverUrl = Deno.env.get("X_SEARCH_SERVER_URL");
    if (!serverUrl) return json({ error: "X_SEARCH_SERVER_URL no configurado" }, 503);

    const body = await request.json();
    const handle = String(body.handle ?? "").replace(/^@/, "").trim();
    if (!handle) return json({ error: "Falta handle" }, 400);

    // Prospect mode: who follows the given (watched) account.
    if (body.mode !== "followback") {
      const users = await fetchList(serverUrl, handle, "followers");
      if ("error" in users) return json(users, 502);
      return json({ mode: "prospects", handle, users });
    }

    // Follow-back mode: cross our own followers and following lists. Two
    // sequential scrapes (the server serializes anyway).
    const followers = await fetchList(serverUrl, handle, "followers");
    if ("error" in followers) return json(followers, 502);
    const following = await fetchList(serverUrl, handle, "following");
    if ("error" in following) return json(following, 502);

    const followerSet = new Set(followers.map((u) => u.handle.toLowerCase()));
    const followingSet = new Set(following.map((u) => u.handle.toLowerCase()));
    const mutuals = following.filter((u) => followerSet.has(u.handle.toLowerCase()));
    const notBack = following.filter((u) => !followerSet.has(u.handle.toLowerCase()));
    const fans = followers.filter((u) => !followingSet.has(u.handle.toLowerCase()));

    return json({
      mode: "followback",
      handle,
      counts: { followers: followers.length, following: following.length },
      mutuals,
      not_back: notBack,
      fans,
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Error" }, 500);
  }
});
