import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/migrations/20260930200000_tierly_event_series_p1.sql", import.meta.url), "utf8");

test("P1 crea una serie mínima vinculada a la primera ocurrencia", () => {
  assert.match(sql, /create table if not exists public\.tierly_event_series/i);
  assert.match(sql, /guild_id text not null references public\.communities\(guild_id\)/i);
  assert.match(sql, /first_event_id uuid not null unique references public\.gaming_events\(id\)/i);
  assert.match(sql, /timezone text not null/i);
  assert.match(sql, /recurrence_rule in \('weekly', 'monthly'\)/i);
  assert.match(sql, /insert into public\.gaming_events[\s\S]*insert into public\.tierly_event_series/i);
});

test("P1 aísla por guild y no expone inserción directa a usuarios", () => {
  assert.match(sql, /alter table public\.tierly_event_series enable row level security/i);
  assert.match(sql, /for select to authenticated[\s\S]*is_community_admin\(guild_id\)/i);
  assert.match(sql, /is_community_admin\(p_guild_id\)/i);
  assert.doesNotMatch(sql, /grant\s+(?:insert|update|delete|all)\s+on public\.tierly_event_series[\s\S]*to authenticated/i);
  assert.match(sql, /grant select on public\.tierly_event_series to authenticated/i);
});

test("P1 restringe la RPC y conserva rollback atómico", () => {
  assert.match(sql, /create or replace function public\.tierly_create_event_series/i);
  assert.match(sql, /security definer[\s\S]*set search_path = ''/i);
  assert.match(sql, /if p_recurrence_rule not in \('weekly', 'monthly'\) then[\s\S]*raise exception/i);
  assert.match(sql, /revoke all on function[\s\S]*from public, anon/i);
  assert.match(sql, /grant execute on function[\s\S]*to authenticated/i);
  assert.doesNotMatch(sql, /commit\s*;/i);
  assert.doesNotMatch(sql, /exception[\s\S]*insert into public\.tierly_event_series[\s\S]*commit/i);
});
