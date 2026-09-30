import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/migrations/20260930152000_tierly_phase1_events_attendance_xp.sql", import.meta.url), "utf8");

test("vincula eventos con comunidades y añade horario", () => {
  assert.match(sql, /gaming_events[\s\S]*guild_id text references public\.communities/i);
  assert.match(sql, /starts_at timestamptz/);
  assert.match(sql, /ends_at timestamptz/);
  assert.match(sql, /timezone text not null/);
  assert.match(sql, /status in \('scheduled', 'live', 'completed', 'cancelled'\)/);
});

test("mantiene asistencia y XP fuera de brackets", () => {
  assert.match(sql, /create table if not exists public\.tierly_event_attendance/);
  assert.match(sql, /registered_at timestamptz/);
  assert.match(sql, /unregistered_at timestamptz/);
  assert.match(sql, /checked_in_at timestamptz/);
  assert.match(sql, /confirmed_at timestamptz/);
  assert.match(sql, /create table if not exists public\.tierly_xp_ledger/);
  assert.match(sql, /unique \(guild_id, idempotency_key\)/i);
  assert.doesNotMatch(sql, /gaming_match_participants[\s\S]*attendance/i);
});

test("habilita RLS y restringe las RPCs", () => {
  for (const table of ["tierly_event_attendance", "tierly_xp_ledger"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  for (const fn of ["register_event", "unregister_event", "check_in_event", "confirm_event_attendance"]) {
    assert.match(sql, new RegExp(`create or replace function public\\.tierly_${fn}`));
  }
  assert.match(sql, /revoke all on function[\s\S]*from public, anon/i);
  assert.match(sql, /grant execute on function[\s\S]*to authenticated/i);
  assert.match(sql, /to service_role/i);
});
