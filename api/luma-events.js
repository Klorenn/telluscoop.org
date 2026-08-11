export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });
  }
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const key = process.env.LUMA_API_KEY;
  if (!key) return json({ error: 'Luma no está configurado' }, 503);

  try {
    const now = Date.now();
    let cursor = '';
    let all = [];
    let upcoming = [];
    for (let page = 0; page < 20 && upcoming.length < 6; page += 1) {
      const suffix = cursor ? `&pagination_cursor=${encodeURIComponent(cursor)}` : '';
      const r = await fetch(`https://public-api.luma.com/public/v1/calendar/list-events?pagination_limit=50${suffix}`, {
        headers: { 'x-luma-api-key': key },
      });
      if (!r.ok) throw new Error(`Luma respondió ${r.status}`);
      const data = await r.json();
      const entries = (data.entries || []).map((entry) => entry.event || entry);
      all = all.concat(entries);
      upcoming = all.filter((event) => event.start_at && new Date(event.start_at).getTime() >= now);
      if (!data.has_more || !data.next_cursor) break;
      cursor = data.next_cursor;
    }

    const url = new URL(req.url);
    if (url.searchParams.get('debug') === '1') return json({ upcoming, scanned: all.length }, 200);

    const events = upcoming
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
      .slice(0, 6)
      .map((event) => ({ name: event.name, start_at: event.start_at, url: event.url }));

    return json({ events }, 200, { 'Cache-Control': 's-maxage=600, stale-while-revalidate=1800' });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...extraHeaders,
    },
  });
}
