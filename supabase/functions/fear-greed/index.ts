import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const json = (body: unknown, status = 200, cache = false) => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...cors,
    "Content-Type": "application/json",
    "Cache-Control": cache ? "public, max-age=900, s-maxage=900, stale-while-revalidate=900" : "no-store",
  },
});

let cached: { value: number; value_classification: string; update_time: string; cachedAt: number } | null = null;
const CACHE_MS = 15 * 60 * 1000;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "GET") return json({ error: "Método no permitido" }, 405);

  if (cached && Date.now() - cached.cachedAt < CACHE_MS) {
    return json({ data: { value: cached.value, value_classification: cached.value_classification, update_time: cached.update_time } }, 200, true);
  }

  const apiKey = Deno.env.get("CMC_PRO_API_KEY");
  if (!apiKey) return json({ error: "CMC_PRO_API_KEY no está configurada" }, 503);

  try {
    const response = await fetch("https://pro-api.coinmarketcap.com/v3/fear-and-greed/latest", {
      headers: { "X-CMC_PRO_API_KEY": apiKey, Accept: "application/json" },
    });
    if (!response.ok) return json({ error: "CoinMarketCap devolvió un error" }, response.status);

    const payload = await response.json();
    const value = Number(payload?.data?.value);
    const classification = payload?.data?.value_classification;
    const updateTime = payload?.data?.update_time;
    if (!Number.isFinite(value) || value < 0 || value > 100 || typeof classification !== "string" || typeof updateTime !== "string") {
      return json({ error: "Respuesta inválida de CoinMarketCap" }, 502);
    }

    cached = { value, value_classification: classification, update_time: updateTime, cachedAt: Date.now() };
    return json({ data: { value, value_classification: classification, update_time: updateTime } }, 200, true);
  } catch (error) {
    console.error(error);
    return json({ error: "No se pudo consultar el índice" }, 502);
  }
});
