import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const maxAgeSeconds = Number(process.env.TIERLY_HEALTH_MAX_AGE_SECONDS || 900);
if (!url || !key) { console.error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY"); process.exit(2); }

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await supabase.from("tierly_bot_health")
  .select("connected_at, heartbeat_at, last_error_at, last_error_code, connection_count, heartbeat_count, error_count, updated_at")
  .eq("bot_key", "tierly-bot").maybeSingle();
if (error || !data) { console.error("No se pudo leer el estado de Tierly"); process.exit(1); }

const heartbeatAge = (Date.now() - new Date(data.heartbeat_at).getTime()) / 1000;
const status = Number.isFinite(heartbeatAge) && heartbeatAge <= maxAgeSeconds ? "ok" : "stale";
console.log(JSON.stringify({ status, heartbeat_age_seconds: Math.round(heartbeatAge), ...data }));
process.exit(status === "ok" ? 0 : 1);
