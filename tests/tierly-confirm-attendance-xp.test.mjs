import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/migrations/20260930170000_tierly_confirm_attendance_xp.sql", import.meta.url), "utf8");

test("la confirmación escribe XP y stamp explícitos en el ledger", () => {
  assert.match(sql, /insert into public\.tierly_xp_ledger/i);
  assert.match(sql, /\n\s*10,\s*\n\s*1,\s*\n\s*'event_attendance'/i);
  assert.match(sql, /'event-attendance:' \|\| p_event_id::text \|\| ':' \|\| p_player_id::text/i);
});

test("la confirmación es idempotente", () => {
  assert.match(sql, /on conflict \(guild_id, idempotency_key\) do nothing/i);
  assert.match(sql, /idempotency_key/i);
});

test("la RPC conserva autorización y ejecución solo para usuarios autenticados", () => {
  assert.match(sql, /is_community_admin\(v_guild\)/i);
  assert.match(sql, /revoke all on function public\.tierly_confirm_event_attendance\(uuid, uuid\) from public, anon/i);
  assert.match(sql, /grant execute on function public\.tierly_confirm_event_attendance\(uuid, uuid\) to authenticated/i);
});
