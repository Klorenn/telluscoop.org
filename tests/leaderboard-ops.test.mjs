import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20260825120000_create_gaming_leaderboard.sql", import.meta.url),
  "utf8",
);

test("every gaming table enables RLS", () => {
  for (const table of [
    "gaming_players", "gaming_events", "gaming_tournaments",
    "gaming_matches", "gaming_match_participants", "gaming_scores", "gaming_rewards",
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
});

test("write policies block viewer role", () => {
  const blocks = migration.match(/_member_all[\s\S]*?with check[\s\S]*?;/g) ?? [];
  assert.ok(blocks.length > 0, "expected at least one _member_all policy");
  for (const block of blocks) {
    assert.match(block, /m\.role <> 'viewer'/);
  }
});

test("public views are the only anon-readable surface, granted explicitly", () => {
  assert.match(migration, /create view public\.leaderboard_public_view/);
  assert.match(migration, /grant select on public\.leaderboard_public_view to anon, authenticated/);
  const lbView = migration.match(/create view public\.leaderboard_public_view[\s\S]*?;/)?.[0] ?? "";
  assert.doesNotMatch(lbView, /discord_id/);

  assert.match(migration, /create view public\.event_bracket_public_view/);
  assert.match(migration, /grant select on public\.event_bracket_public_view to anon, authenticated/);

  assert.match(migration, /create view public\.gaming_rewards_public_view/);
  assert.match(migration, /grant select on public\.gaming_rewards_public_view to anon, authenticated/);

  assert.doesNotMatch(migration, /grant select on public\.gaming_players to anon/);
  assert.doesNotMatch(migration, /grant select on public\.gaming_scores to anon/);
});

test("score trigger is security definer with a locked search_path", () => {
  const fn = migration.match(/create or replace function public\.recalculate_gaming_score[\s\S]*?\$\$;/)?.[0] ?? "";
  assert.match(fn, /security definer/);
  assert.match(fn, /set search_path = ''/);
});

test("points formula matches the tested pure function (10/6/3/1)", () => {
  const fn = migration.match(/create or replace function public\.gaming_points_for_placement[\s\S]*?\$\$;/)?.[0] ?? "";
  assert.match(fn, /placement = 1 then 10/);
  assert.match(fn, /placement = 2 then 6/);
  assert.match(fn, /placement = 3 then 3/);
  assert.match(fn, /else 1/);
});
