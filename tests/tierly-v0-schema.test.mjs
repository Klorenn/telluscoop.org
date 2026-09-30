import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("../supabase/migrations/20260929090000_tierly_v0_schema.sql", import.meta.url),
  "utf8",
);

const tables = [
  "communities",
  "community_admins",
  "observed_members",
  "games",
  "game_aliases",
  "play_sessions",
  "daily_game_rollups",
  "suggested_events",
];

test("crea todas las tablas del modelo V0", () => {
  for (const table of tables) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\b`, "i"));
  }
});

test("habilita RLS en todas las tablas nuevas", () => {
  for (const table of tables) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
});

test("ninguna tabla nueva concede acceso a anon", () => {
  assert.doesNotMatch(sql, /to\s+anon/i);
});

test("los umbrales son configurables por comunidad", () => {
  assert.match(sql, /retention_days\s+integer\s+not null default 30/i);
  assert.match(sql, /session_cap_minutes\s+integer\s+not null default 480/i);
  assert.match(sql, /stale_session_hours\s+integer\s+not null default 12/i);
  assert.match(sql, /suggestion_threshold\s+integer\s+not null default 5/i);
});

test("solo existe una sesión abierta por guild, usuario y juego", () => {
  assert.match(sql, /create unique index[\s\S]*play_sessions[\s\S]*\(guild_id, discord_user_id, game_id\)[\s\S]*where ended_at is null/i);
});

test("los rollups son únicos por guild, juego y día", () => {
  assert.match(sql, /create unique index[\s\S]*daily_game_rollups[\s\S]*\(guild_id, game_id, day\)/i);
});

test("el panel puede usar la función de autorización sin exponerla públicamente", () => {
  assert.match(sql, /create or replace function public\.is_community_admin[\s\S]*security definer/i);
  assert.match(sql, /revoke all on function public\.is_community_admin\(text\) from public/i);
  assert.match(sql, /grant execute on function public\.is_community_admin\(text\) to authenticated/i);
});

test("las políticas se pueden recrear tras una ejecución parcial", () => {
  for (const policy of [
    "communities_read",
    "community_admins_read",
    "observed_members_read",
    "games_read",
    "game_aliases_read",
    "play_sessions_read",
    "daily_game_rollups_read",
    "suggested_events_read",
  ]) {
    assert.match(sql, new RegExp(`drop policy if exists ${policy}`, "i"));
  }
});
