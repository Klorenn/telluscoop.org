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

async function luma(path: string, key: string) {
  const response = await fetch(`https://public-api.luma.com${path}`, {
    headers: { "x-luma-api-key": key },
  });
  if (!response.ok) throw new Error(`Luma respondió ${response.status}`);
  return response.json();
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
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!membership) return json({ error: "Solo administradores pueden sincronizar Luma" }, 403);

    const key = Deno.env.get("LUMA_API_KEY");
    if (!key) return json({ error: "Luma todavía no está configurado" }, 503);
    const body = await request.json();

    if (body.action === "list") {
      const data = await luma("/v1/calendars/events/list?access=manage&pagination_limit=100&sort_column=start_at&sort_direction=desc", key);
      const events = (data.entries || []).map((event: Record<string, unknown>) => ({
        id: event.id,
        name: event.name,
        start_at: event.start_at,
        end_at: event.end_at,
        url: event.url,
      }));
      return json({ events });
    }

    if (body.action === "details" && typeof body.event_id === "string") {
      const eventId = encodeURIComponent(body.event_id);
      const event = await luma(`/v1/events/get?event_id=${eventId}`, key);
      let cursor = "";
      let registered = 0;
      let checkedIn = 0;
      do {
        const suffix = cursor ? `&pagination_cursor=${encodeURIComponent(cursor)}` : "";
        const guests = await luma(`/v1/events/guests/list?event_id=${eventId}&pagination_limit=100${suffix}`, key);
        for (const guest of guests.entries || []) {
          if (["approved", "session"].includes(guest.approval_status)) registered += 1;
          if (guest.checked_in_at) checkedIn += 1;
        }
        cursor = guests.next_cursor || "";
      } while (cursor);
      return json({
        event: { id: event.id, name: event.name, start_at: event.start_at, end_at: event.end_at, url: event.url },
        registered_count: registered,
        checked_in_count: checkedIn,
      });
    }

    return json({ error: "Acción inválida" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Error de sincronización" }, 500);
  }
});
