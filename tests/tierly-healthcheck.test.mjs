import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/20260930210000_tierly_bot_healthcheck.sql", import.meta.url), "utf8");
const bot = await readFile(new URL("../discord-bot/index.js", import.meta.url), "utf8");
const healthcheck = await readFile(new URL("../discord-bot/healthcheck.mjs", import.meta.url), "utf8");
const readme = await readFile(new URL("../discord-bot/README.md", import.meta.url), "utf8");

test("el healthcheck solo almacena timestamps, códigos y contadores técnicos", () => {
  assert.match(migration, /create table if not exists public\.tierly_bot_health/i);
  for (const field of ["connected_at", "heartbeat_at", "last_error_at", "connection_count", "heartbeat_count", "error_count"]) {
    assert.match(migration, new RegExp(`\\b${field}\\b`, "i"));
  }
  assert.doesNotMatch(migration, /discord_user_id|user_id|display_name|message|token/i);
});

test("la tabla y las RPCs quedan limitadas a service_role", () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.tierly_bot_health from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.tierly_bot_health_heartbeat[\s\S]*to service_role/i);
  assert.match(migration, /grant execute on function public\.tierly_bot_health_error[\s\S]*to service_role/i);
  assert.doesNotMatch(migration, /grant .* to anon/i);
});

test("el bot registra conexión, heartbeat y errores normalizados", () => {
  assert.match(bot, /tierly_bot_health_heartbeat/);
  assert.match(bot, /tierly_bot_health_error/);
  assert.match(bot, /recordBotHealth\("connected"\)/);
  assert.match(bot, /recordBotHealth\("heartbeat"\)/);
  assert.match(bot, /presence_update/);
});

test("el comando healthcheck detecta heartbeat obsoleto sin imprimir secretos", () => {
  assert.match(healthcheck, /TIERLY_HEALTH_MAX_AGE_SECONDS/);
  assert.match(healthcheck, /heartbeat_age_seconds/);
  assert.match(healthcheck, /process\.exit\(status === "ok" \? 0 : 1\)/);
  assert.doesNotMatch(healthcheck, /console\.log\([^\n]*SERVICE_ROLE_KEY/i);
});

test("la documentación incluye systemd y el criterio de stale", () => {
  assert.match(readme, /tierly-healthcheck\.timer/);
  assert.match(readme, /TIERLY_HEALTH_MAX_AGE_SECONDS/);
  assert.match(readme, /EnvironmentFile=.*discord-bot\/\.env/);
});
