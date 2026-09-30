import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const eventsSql = readFileSync(
  new URL("../supabase/migrations/20260930250000_tierly_community_events_public_view.sql", import.meta.url),
  "utf8",
);
const leaderboardSql = readFileSync(
  new URL("../supabase/migrations/20260930240000_tierly_restore_leaderboard_public_view.sql", import.meta.url),
  "utf8",
);

test("la vista pública de eventos se lee como anon y authenticated", () => {
  assert.match(eventsSql, /create or replace view public\.tierly_community_events_public_view/);
  assert.match(eventsSql, /grant select on public\.tierly_community_events_public_view to anon, authenticated/);
});

test("la vista pública de eventos une la comunidad y cuenta inscripciones", () => {
  assert.match(eventsSql, /join public\.communities c on c\.guild_id = e\.guild_id/);
  assert.match(eventsSql, /from public\.tierly_event_attendance a/);
  assert.match(eventsSql, /a\.unregistered_at is null/);
});

test("la vista pública de eventos no expone guild_id ni identidades de asistentes", () => {
  const projection = eventsSql.match(/create or replace view public\.tierly_community_events_public_view[\s\S]*?;/)?.[0] ?? "";
  assert.doesNotMatch(projection, /\bguild_id\s+as\b/);
  assert.doesNotMatch(projection, /display_name/);
  assert.doesNotMatch(projection, /player_id/);
  assert.doesNotMatch(projection, /discord_id/);
});

test("la vista pública solo publica eventos scheduled y live", () => {
  assert.match(eventsSql, /e\.status in \('scheduled', 'live'\)/);
});

test("la vista de leaderboard se lee como anon y authenticated", () => {
  assert.match(leaderboardSql, /create view public\.leaderboard_public_view/);
  assert.match(leaderboardSql, /grant select on public\.leaderboard_public_view to anon, authenticated/);
});

test("la vista de leaderboard no filtra discord_id ni auth_user_id", () => {
  const projection = leaderboardSql.match(/create view public\.leaderboard_public_view[\s\S]*?;/)?.[0] ?? "";
  assert.notEqual(projection, "");
  assert.doesNotMatch(projection, /discord_id/);
  assert.doesNotMatch(projection, /auth_user_id/);
  assert.match(projection, /where p\.discord_member is true/);
});

test("la vista de leaderboard conserva el perfil que renderiza la tarjeta de jugador", () => {
  for (const column of ["player_id", "username", "display_name", "avatar_url", "discord_member", "banner", "banner_fit", "bio", "total_points"]) {
    assert.match(leaderboardSql, new RegExp(`\\b${column}\\b`), `falta ${column}`);
  }
});
