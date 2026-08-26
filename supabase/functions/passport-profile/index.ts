import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PASSPORT_API_BASE = "https://demo.stellarpassport.xyz/api/v1";
const TIERLY_ORG_SLUG = "stellar-chile";

const cors = {
  "Access-Control-Allow-Origin": "https://telluscoop.org",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

async function passport(path: string, key: string) {
  const response = await fetch(`${PASSPORT_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (response.status === 429) throw new Error("rate_limited");
  if (!response.ok) throw new Error(`passport_${response.status}`);
  return response.json();
}

Deno.serve(async (request) => {
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
      const query = (url.searchParams.get("q") || "").trim().toLowerCase();
      if (query.length < 2) return json({ builders: [] });

      // Passport's /builders endpoint has no text-search param — page through
      // results ourselves and match on name/username, capped to stay within
      // the 100 req/min rate limit.
      const matches: unknown[] = [];
      const pageSize = 100;
      const maxPages = 3;
      for (let page = 0; page < maxPages && matches.length < 20; page++) {
        const res = await passport(`/builders?limit=${pageSize}&offset=${page * pageSize}`, key);
        const items = (res.data || []) as { name?: string; username?: string }[];
        for (const builder of items) {
          if ((builder.name || "").toLowerCase().includes(query) || (builder.username || "").toLowerCase().includes(query)) {
            matches.push(builder);
            if (matches.length >= 20) break;
          }
        }
        if (items.length < pageSize) break;
      }
      return json({ builders: matches });
    }

    if (action === "profile") {
      const username = url.searchParams.get("username");
      if (!username) return json({ error: "Falta username" }, 400);
      const builder = await passport(`/builders/${encodeURIComponent(username)}`, key);
      return json({ builder: builder.data });
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
