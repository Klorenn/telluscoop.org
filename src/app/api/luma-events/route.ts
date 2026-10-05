/**
 * Preserves the existing /api/luma-events endpoint used by hub.html.
 */
export const runtime = "edge";

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      ...extraHeaders,
    },
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}

type LumaEvent = {
  name?: string;
  start_at?: string;
  url?: string;
  cover_url?: string | null;
};

export async function GET() {
  const key = process.env.LUMA_API_KEY;
  if (!key) return json({ error: "Luma no está configurado" }, 503);

  try {
    const now = Date.now();
    let cursor = "";
    let all: LumaEvent[] = [];
    let upcoming: LumaEvent[] = [];
    for (let page = 0; page < 20 && upcoming.length < 6; page += 1) {
      const suffix = cursor ? `&pagination_cursor=${encodeURIComponent(cursor)}` : "";
      const r = await fetch(`https://public-api.luma.com/public/v1/calendar/list-events?pagination_limit=50${suffix}`, {
        headers: { "x-luma-api-key": key },
      });
      if (!r.ok) throw new Error(`Luma respondió ${r.status}`);
      const data = (await r.json()) as {
        entries?: Array<{ event?: LumaEvent } | LumaEvent>;
        has_more?: boolean;
        next_cursor?: string;
      };
      const entries = (data.entries || []).map((entry) => ("event" in entry && entry.event ? entry.event : (entry as LumaEvent)));
      all = all.concat(entries);
      upcoming = all.filter((event) => event.start_at && new Date(event.start_at).getTime() >= now);
      if (!data.has_more || !data.next_cursor) break;
      cursor = data.next_cursor;
    }

    const events = upcoming
      .sort((a, b) => new Date(a.start_at || 0).getTime() - new Date(b.start_at || 0).getTime())
      .slice(0, 6)
      .map((event) => ({
        name: event.name,
        start_at: event.start_at,
        url: event.url,
        cover_url: event.cover_url || null,
      }));

    return json({ events }, 200, { "Cache-Control": "s-maxage=600, stale-while-revalidate=1800" });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
}
