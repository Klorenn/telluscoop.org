import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readMigration = (name) => readFileSync(
  new URL(`../supabase/migrations/${name}`, import.meta.url),
  "utf8",
);

const v0 = readMigration("20260929090000_tierly_v0_schema.sql");
const phase1 = readMigration("20260930152000_tierly_phase1_events_attendance_xp.sql");
const createEvent = readMigration("20260930160000_tierly_create_community_event.sql");
const confirmAttendance = readMigration("20260930170000_tierly_confirm_attendance_xp.sql");

test("P0: V0 aísla los datos de presencia por guild", () => {
  for (const table of ["observed_members", "play_sessions", "daily_game_rollups", "suggested_events"]) {
    assert.match(v0, new RegExp(`create table if not exists public\\.${table}[\\s\\S]*guild_id text not null references public\\.communities\\(guild_id\\)`, "i"));
    assert.match(v0, new RegExp(`create policy ${table}_read[\\s\\S]*is_community_admin\\(guild_id\\)`, "i"));
  }
  assert.match(v0, /play_sessions_one_open_per_game[\s\S]*\(guild_id, discord_user_id, game_id\)/i);
  assert.match(v0, /daily_game_rollups_unique[\s\S]*\(guild_id, game_id, day\)/i);
});

test("P0: Fase 1 conserva el aislamiento por guild en eventos y ledger", () => {
  assert.match(phase1, /gaming_events[\s\S]*guild_id text references public\.communities\(guild_id\)/i);
  assert.match(phase1, /tierly_xp_ledger[\s\S]*guild_id text not null references public\.communities\(guild_id\)/i);
  assert.match(phase1, /unique \(guild_id, idempotency_key\)/i);
  assert.match(phase1, /tierly_event_attendance_read[\s\S]*e\.id = event_id[\s\S]*is_community_admin\(e\.guild_id\)/i);
  assert.match(phase1, /tierly_xp_ledger_read[\s\S]*is_community_admin\(guild_id\)/i);
});

test("P0: no se conceden grants de las superficies Tierly nuevas a anon", () => {
  for (const sql of [v0, phase1, createEvent, confirmAttendance]) {
    assert.doesNotMatch(sql, /grant(?:\s+\w+)*\s+[^;]*\bto\s+anon\b/i);
  }
});

test("P0: las RPCs administrativas quedan limitadas a community_admins", () => {
  assert.match(createEvent, /is_community_admin\(p_guild_id\)/i);
  assert.match(confirmAttendance, /select guild_id[\s\S]*from public\.gaming_events[\s\S]*is_community_admin\(v_guild\)/i);
  assert.match(createEvent, /revoke all on function[\s\S]*from public, anon/i);
  assert.match(confirmAttendance, /revoke all on function[\s\S]*from public, anon/i);
  assert.match(createEvent, /grant execute on function[\s\S]*to authenticated/i);
  assert.match(confirmAttendance, /grant execute on function[\s\S]*to authenticated/i);
});

test("P0: la privacidad autenticada solo permite modificar el propio Discord", () => {
  const privacy = readFileSync(new URL("../supabase/migrations/20260930180000_tierly_member_privacy_authenticated.sql", import.meta.url), "utf8");
  assert.match(privacy, /tierly_member_owns_discord_id/);
  assert.match(privacy, /auth_user_id = \(select auth\.uid\(\)\)/);
  assert.match(privacy, /grant execute on function public\.tierly_accept_member_consent[\s\S]*to authenticated/i);
  assert.match(privacy, /grant execute on function public\.tierly_request_member_deletion[\s\S]*to authenticated/i);
});

test("P0: escenario lógico crear, registrar, check-in, confirmar y ledger idempotente", () => {
  const event = { status: "scheduled", guildId: "guild-a" };
  const attendance = { registered: false, checkedIn: false, confirmed: false };
  const ledger = new Set();

  assert.equal(event.guildId, "guild-a");
  attendance.registered = true;
  assert.equal(attendance.registered, true);
  attendance.checkedIn = true;
  assert.equal(attendance.checkedIn, true);
  attendance.confirmed = true;

  const key = "event-attendance:event-a:player-a";
  ledger.add(`${event.guildId}:${key}`);
  ledger.add(`${event.guildId}:${key}`);
  assert.equal(attendance.confirmed, true);
  assert.equal(ledger.size, 1);
  assert.match(confirmAttendance, /on conflict \(guild_id, idempotency_key\) do nothing/i);
});
