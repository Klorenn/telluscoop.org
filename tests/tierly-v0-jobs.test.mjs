import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../supabase/migrations/20260929092000_tierly_v0_jobs.sql", import.meta.url),
  "utf8",
);

test("define las funciones que el bot invoca por RPC", () => {
  assert.match(sql, /create or replace function public\.tierly_close_sessions_at_heartbeat/i);
  assert.match(sql, /create or replace function public\.tierly_close_orphan_sessions/i);
});

test("el cierre usa last_heartbeat_at como hora de fin", () => {
  assert.match(sql, /ended_at\s*=\s*last_heartbeat_at/i);
});

test("el rollup aplica el cap de minutos por comunidad", () => {
  assert.match(sql, /least\([^)]*session_cap_minutes/i);
});

test("agrega antes de purgar", () => {
  const rollupPos = sql.search(/insert into public\.daily_game_rollups/i);
  const purgePos = sql.search(/delete from public\.play_sessions/i);
  assert.ok(rollupPos > -1 && purgePos > -1);
  assert.ok(rollupPos < purgePos, "el rollup debe ocurrir antes de la purga");
});

test("las sugerencias respetan el umbral y no duplican pendientes", () => {
  assert.match(sql, /suggestion_threshold/i);
  assert.match(sql, /status\s*=\s*'pending'/i);
  assert.match(sql, /not exists/i);
});

test("programa los jobs con pg_cron", () => {
  assert.match(sql, /cron\.schedule/i);
});

test("la RPC administrativa actualiza sugerencias con estado permitido", () => {
  const adminSql = readFileSync(new URL("../supabase/migrations/20260930140000_tierly_admin_suggestion_status.sql", import.meta.url), "utf8");
  assert.match(adminSql, /tierly_update_suggestion_status/i);
  assert.match(adminSql, /p_status not in \('accepted', 'dismissed'\)/i);
  assert.match(adminSql, /community_admins/);
  assert.match(adminSql, /grant execute on function public\.tierly_update_suggestion_status\(bigint, text\) to authenticated/i);
  assert.doesNotMatch(adminSql, /to anon/i);
});
