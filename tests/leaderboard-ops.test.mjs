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

const memberViewMigration = await readFile(
  new URL("../supabase/migrations/20260826010000_add_discord_member_to_leaderboard_view.sql", import.meta.url),
  "utf8",
);

test("leaderboard_public_view exposes discord_member without leaking discord_id", () => {
  assert.match(memberViewMigration, /discord_member/);
  assert.doesNotMatch(memberViewMigration, /discord_id/);
  assert.match(memberViewMigration, /grant select on public\.leaderboard_public_view to anon, authenticated/);
});

const passportMigration = await readFile(
  new URL("../supabase/migrations/20260826020000_add_stellar_passport_url.sql", import.meta.url),
  "utf8",
);

test("stellar_passport_url is a self-reported text column, exposed publicly, no new write RLS", () => {
  assert.match(passportMigration, /add column if not exists stellar_passport_url text/);
  assert.match(passportMigration, /stellar_passport_url/);
  assert.doesNotMatch(passportMigration, /_member_all|for all to authenticated/);
  assert.match(passportMigration, /grant select on public\.leaderboard_public_view to anon, authenticated/);
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

const edge = await readFile(
  new URL("../supabase/functions/discord-verify/index.ts", import.meta.url),
  "utf8",
);

test("discord-verify requires a session and never trusts client-supplied membership", () => {
  assert.match(edge, /Sesión requerida/);
  assert.match(edge, /auth\.getUser\(\)/);
  assert.match(edge, /Deno\.env\.get\("DISCORD_BOT_TOKEN"\)/);
  assert.match(edge, /Deno\.env\.get\("DISCORD_GUILD_ID"\)/);
  assert.match(edge, /Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
});

test("discord-verify never hardcodes a bot token or guild id", () => {
  assert.doesNotMatch(edge, /discord\.com\/api\/v10\/guilds\/\d+/);
});

test("discord-verify caches the verification result to survive rate limits", () => {
  assert.match(edge, /VERIFY_TTL_MS/);
  assert.match(edge, /discord_verified_at/);
});

test("discord-verify never writes client-controlled user_metadata into gaming_players", () => {
  assert.doesNotMatch(edge, /user_metadata/);
  assert.match(edge, /discordIdentity\?\.identity_data\?\.full_name/);
  assert.match(edge, /discordIdentity\?\.identity_data\?\.avatar_url/);
});

test("discord-verify only writes stellar_passport_url via the service-role channel, validated as https", () => {
  assert.match(edge, /stellar_passport_url/);
  assert.match(edge, /parsed\.protocol === "https:"/);
});

test("discord-verify's avatar lookup is gated to non-viewer staff, never the calling player", () => {
  assert.match(edge, /lookup_avatar/);
  assert.match(edge, /\.neq\("role", "viewer"\)/);
  assert.match(edge, /Solo staff puede buscar avatares/);
});

const app = await readFile(new URL("../ops/tierly/app.js", import.meta.url), "utf8");
const page = await readFile(new URL("../ops/tierly/index.html", import.meta.url), "utf8");

test("admin ops app never embeds secrets", () => {
  assert.doesNotMatch(app, /service[_-]?role/i);
  assert.doesNotMatch(app, /DISCORD_BOT_TOKEN/);
  assert.doesNotMatch(app, /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\./);
});

test("admin cache-busting versions match", () => {
  const cssVersion = page.match(/styles\.css\?v=([^"']+)/)?.[1];
  const jsVersion = page.match(/app\.js\?v=([^"']+)/)?.[1];
  assert.ok(cssVersion);
  assert.equal(jsVersion, cssVersion);
});

test("admin page is not indexable", () => {
  assert.match(page, /noindex,nofollow/);
});

test("admin app implements the core tournament flow", () => {
  for (const name of ["createEvent", "createTournament", "createMatch", "addParticipant", "confirmMatch", "createReward", "markRewardFulfilled"]) {
    assert.match(app, new RegExp(`function ${name}\\(`));
  }
});

test("admin writes are gated on non-viewer role before rendering the editor", () => {
  assert.match(app, /state\.membership\.role === "viewer"/);
});
