# Gaming Leaderboard Phase 1 (Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 1 (Core) of the Tellus gaming leaderboard — data model, public `/leaderboard` ranking page, admin panel at `ops/leaderboard/`, and Discord login + server-side guild-membership verification.

**Architecture:** New Supabase tables (`gaming_*`) with the repo's standard org-scoped RLS for staff writes, plus three new anon-readable `*_public_view` views (the repo's first anon-read surface) so the public page never touches base tables. A `security definer` trigger recalculates `gaming_scores` whenever an admin confirms a match. Discord guild membership is checked server-side by a new `discord-verify` Edge Function (sibling of `luma-events`) using a bot token that only ever lives as a Supabase secret. The admin panel is a vanilla-JS IIFE app following the exact `ops/stellar/` / `ops/social/` shape. The public page is a standalone static HTML+vanilla-JS page following the `resources/` shape (no React/Babel, no bundler).

**Tech Stack:** Supabase Postgres + RLS + Edge Functions (Deno/TS), vanilla JS (no framework), `node:test` for tests, static HTML/CSS, Vercel rewrites.

**Spec:** `docs/superpowers/specs/2026-08-24-gaming-leaderboard-design.md` (status: aprobado — this plan implements Phase 1 only; Phases 2/3 are explicitly out of scope and get their own future specs).

## Global Constraints

- No player wallets. `gaming_players.stellar_address` exists but is unused until Phase 3.
- No persistent Discord bot/gateway process. `discord-verify` only makes outbound REST calls with a bot token — never a gateway connection. This repo is 100% static + serverless (Vercel).
- No points redemption store — rewards are admin-assigned per tournament result, never bought with points.
- No Discord slash commands / Interactions endpoint in this phase.
- Viewing `/leaderboard` never requires login. Discord login only unlocks the viewer's own linked history.
- Secrets (`DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`) live only as Supabase Edge Function secrets — never in frontend code, `config.js`, `.env.local`, or git. The Supabase **publishable** key is intentionally public (same key already used by `ops/stellar` and `ops/social`); authorization is enforced entirely by RLS.
- Public page must be bilingual (en/es).
- Any new `ops/*` app's `?v=YYYYMMDD-NN` cache-busting suffix must match between its `app.js` and `styles.css` — `tests/*.test.mjs` enforces this identically to `tests/stellar-ops.test.mjs`.
- Tests follow the repo's existing convention: static regex/string assertions against source files via `node:test` (no runtime DOM execution, no Supabase in tests) — except the points-formula test, which is a real executable unit test of a pure function (the one piece of logic worth testing in isolation, per spec).
- Confirming a match is the only write that fans out to other effects (score trigger now; webhook post + on-chain anchor in later phases) — the score trigger must be idempotent (unique constraint on `(match_id, player_id)` prevents double-scoring a match).

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260825120000_create_gaming_leaderboard.sql` | New `gaming_*` tables, RLS, score trigger, public views |
| `leaderboard/points.mjs` | Pure points-formula function (also the file the unit test imports) |
| `supabase/functions/discord-verify/index.ts` | Server-side Discord guild-membership check |
| `ops/leaderboard/config.js` | Public Supabase URL + publishable key (same pattern as `ops/stellar/config.js`) |
| `ops/leaderboard/index.html` | Admin shell, cache-busted script/style tags |
| `ops/leaderboard/app.js` | Admin IIFE: events/tournaments/matches/rewards CRUD, match confirmation |
| `ops/leaderboard/styles.css` | Admin styles (copied from `ops/stellar/styles.css` as a base) |
| `ops/leaderboard/README.md` | Manual setup steps (Discord App, secrets, redirect allowlist) |
| `leaderboard/index.html` | Public leaderboard page markup |
| `leaderboard/app.js` | Public page: ranking/bracket/rewards fetch+render, Discord login |
| `vercel.json` | Add `/leaderboard` rewrite |
| `i18n.js` | Add `lb*` en/es keys (source-of-truth dictionary; duplicated locally in `leaderboard/app.js` since that page doesn't load Babel/React — see Task 5) |
| `tests/leaderboard-points.test.mjs` | Real unit test for the points formula |
| `tests/leaderboard-ops.test.mjs` | Static assertions: migration, edge function, admin app |
| `tests/leaderboard-public.test.mjs` | Static assertions: public page, `vercel.json` |

---

### Task 1: Points formula (pure function + real unit test)

**Files:**
- Create: `leaderboard/points.mjs`
- Test: `tests/leaderboard-points.test.mjs`

**Interfaces:**
- Produces: `calculatePoints(placement: number): number` — 1st=10, 2nd=6, 3rd=3, anything else=1. Consumed later by Task 2's SQL trigger (mirrored as literal SQL, kept in sync manually and checked by Task 3's test) and optionally by Task 4's admin UI as a live preview.

- [ ] **Step 1: Write the failing test**

```js
// tests/leaderboard-points.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePoints } from "../leaderboard/points.mjs";

test("1st place scores 10 points", () => {
  assert.equal(calculatePoints(1), 10);
});

test("2nd place scores 6 points", () => {
  assert.equal(calculatePoints(2), 6);
});

test("3rd place scores 3 points", () => {
  assert.equal(calculatePoints(3), 3);
});

test("any other placement scores 1 participation point", () => {
  assert.equal(calculatePoints(4), 1);
  assert.equal(calculatePoints(8), 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../leaderboard/points.mjs'`

- [ ] **Step 3: Write minimal implementation**

```js
// leaderboard/points.mjs
export function calculatePoints(placement) {
  if (placement === 1) return 10;
  if (placement === 2) return 6;
  if (placement === 3) return 3;
  return 1;
}

if (typeof window !== "undefined") {
  window.calculatePoints = calculatePoints;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: all 4 assertions in `tests/leaderboard-points.test.mjs` PASS

- [ ] **Step 5: Commit**

```bash
git add leaderboard/points.mjs tests/leaderboard-points.test.mjs
git commit -m "feat(leaderboard): add points-formula pure function"
```

---

### Task 2: Database migration — schema, RLS, score trigger, public views

**Files:**
- Create: `supabase/migrations/20260825120000_create_gaming_leaderboard.sql`
- Test: `tests/leaderboard-ops.test.mjs` (new file, this task writes the migration-related assertions only — Tasks 3 and 4 append more to the same file)

**Interfaces:**
- Produces: tables `gaming_players`, `gaming_events`, `gaming_tournaments`, `gaming_matches`, `gaming_match_participants`, `gaming_scores`, `gaming_rewards`; views `leaderboard_public_view`, `event_bracket_public_view`, `gaming_rewards_public_view` (all `grant select ... to anon, authenticated`); function `public.gaming_points_for_placement(placement int) returns int` (values must match Task 1's `calculatePoints` exactly — 10/6/3/1). Consumed by: Task 3 (edge function upserts `gaming_players`, reads `discord_member`/`discord_verified_at`), Task 4 (admin app reads/writes all base tables), Task 5 (public page reads only the three `*_public_view` views).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260825120000_create_gaming_leaderboard.sql
-- Gaming leaderboard — Fase 1 (core): jugadores, eventos, torneos, partidas, puntajes, premios.
-- Ver docs/superpowers/specs/2026-08-24-gaming-leaderboard-design.md

create table public.gaming_players (
  id uuid primary key default gen_random_uuid(),
  discord_id text not null unique,
  display_name text,
  avatar_url text,
  stellar_address text,
  discord_member boolean,
  discord_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger gaming_players_touch before update on public.gaming_players
for each row execute function public.touch_updated_at();

create table public.gaming_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  event_date date,
  location text,
  created_at timestamptz not null default now()
);
create index gaming_events_org_idx on public.gaming_events(organization_id, event_date desc);

create table public.gaming_tournaments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.gaming_events(id) on delete cascade,
  game text not null,
  format text not null check (format in ('elimination', 'heats')),
  status text not null default 'draft' check (status in ('draft', 'live', 'completed')),
  created_at timestamptz not null default now()
);
create index gaming_tournaments_event_idx on public.gaming_tournaments(event_id);

create table public.gaming_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.gaming_tournaments(id) on delete cascade,
  round int,
  next_match_id uuid references public.gaming_matches(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'live', 'confirmed')),
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index gaming_matches_tournament_idx on public.gaming_matches(tournament_id);

create table public.gaming_match_participants (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.gaming_matches(id) on delete cascade,
  player_id uuid not null references public.gaming_players(id) on delete cascade,
  placement int not null check (placement > 0),
  points_awarded int not null default 0,
  unique (match_id, player_id)
);
create index gaming_match_participants_player_idx on public.gaming_match_participants(player_id);

create table public.gaming_scores (
  player_id uuid primary key references public.gaming_players(id) on delete cascade,
  total_points int not null default 0,
  updated_at timestamptz not null default now()
);

create table public.gaming_rewards (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.gaming_players(id) on delete cascade,
  tournament_id uuid not null references public.gaming_tournaments(id) on delete cascade,
  description text not null,
  fulfilled boolean not null default false,
  fulfilled_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index gaming_rewards_player_idx on public.gaming_rewards(player_id);

-- Fórmula de puntos (debe coincidir con leaderboard/points.mjs: 1ro=10, 2do=6, 3ro=3, resto=1)
create or replace function public.gaming_points_for_placement(placement int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when placement = 1 then 10
    when placement = 2 then 6
    when placement = 3 then 3
    else 1
  end;
$$;

create or replace function public.recalculate_gaming_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'UPDATE' and new.status = 'confirmed' and old.status is distinct from 'confirmed') then
    update public.gaming_match_participants
    set points_awarded = public.gaming_points_for_placement(placement)
    where match_id = new.id;

    insert into public.gaming_scores (player_id, total_points, updated_at)
    select mp.player_id, sum(mp.points_awarded), now()
    from public.gaming_match_participants mp
    join public.gaming_matches m on m.id = mp.match_id
    where m.status = 'confirmed'
      and mp.player_id in (select player_id from public.gaming_match_participants where match_id = new.id)
    group by mp.player_id
    on conflict (player_id) do update set total_points = excluded.total_points, updated_at = excluded.updated_at;
  end if;
  return new;
end;
$$;

drop trigger if exists gaming_matches_confirm_score on public.gaming_matches;
create trigger gaming_matches_confirm_score after update of status on public.gaming_matches
for each row execute function public.recalculate_gaming_score();

-- RLS: escritura de staff acotada por organization_members, igual que el resto del repo.
alter table public.gaming_players enable row level security;
alter table public.gaming_events enable row level security;
alter table public.gaming_tournaments enable row level security;
alter table public.gaming_matches enable row level security;
alter table public.gaming_match_participants enable row level security;
alter table public.gaming_scores enable row level security;
alter table public.gaming_rewards enable row level security;

create policy gaming_players_member_select on public.gaming_players for select to authenticated
using (exists (select 1 from public.organization_members m where m.user_id = (select auth.uid())));
create policy gaming_players_member_all on public.gaming_players for all to authenticated
using (exists (select 1 from public.organization_members m where m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.user_id = (select auth.uid()) and m.role <> 'viewer'));
grant select, insert, update, delete on public.gaming_players to authenticated;

create policy gaming_events_member_select on public.gaming_events for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = gaming_events.organization_id and m.user_id = (select auth.uid())));
create policy gaming_events_member_all on public.gaming_events for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = gaming_events.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = gaming_events.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));
grant select, insert, update, delete on public.gaming_events to authenticated;

create policy gaming_tournaments_member_select on public.gaming_tournaments for select to authenticated
using (exists (select 1 from public.gaming_events e join public.organization_members m on m.organization_id = e.organization_id where e.id = gaming_tournaments.event_id and m.user_id = (select auth.uid())));
create policy gaming_tournaments_member_all on public.gaming_tournaments for all to authenticated
using (exists (select 1 from public.gaming_events e join public.organization_members m on m.organization_id = e.organization_id where e.id = gaming_tournaments.event_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.gaming_events e join public.organization_members m on m.organization_id = e.organization_id where e.id = gaming_tournaments.event_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));
grant select, insert, update, delete on public.gaming_tournaments to authenticated;

create policy gaming_matches_member_select on public.gaming_matches for select to authenticated
using (exists (select 1 from public.gaming_tournaments t join public.gaming_events e on e.id = t.event_id join public.organization_members m on m.organization_id = e.organization_id where t.id = gaming_matches.tournament_id and m.user_id = (select auth.uid())));
create policy gaming_matches_member_all on public.gaming_matches for all to authenticated
using (exists (select 1 from public.gaming_tournaments t join public.gaming_events e on e.id = t.event_id join public.organization_members m on m.organization_id = e.organization_id where t.id = gaming_matches.tournament_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.gaming_tournaments t join public.gaming_events e on e.id = t.event_id join public.organization_members m on m.organization_id = e.organization_id where t.id = gaming_matches.tournament_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));
grant select, insert, update, delete on public.gaming_matches to authenticated;

create policy gaming_match_participants_member_select on public.gaming_match_participants for select to authenticated
using (exists (select 1 from public.gaming_matches gm join public.gaming_tournaments t on t.id = gm.tournament_id join public.gaming_events e on e.id = t.event_id join public.organization_members m on m.organization_id = e.organization_id where gm.id = gaming_match_participants.match_id and m.user_id = (select auth.uid())));
create policy gaming_match_participants_member_all on public.gaming_match_participants for all to authenticated
using (exists (select 1 from public.gaming_matches gm join public.gaming_tournaments t on t.id = gm.tournament_id join public.gaming_events e on e.id = t.event_id join public.organization_members m on m.organization_id = e.organization_id where gm.id = gaming_match_participants.match_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.gaming_matches gm join public.gaming_tournaments t on t.id = gm.tournament_id join public.gaming_events e on e.id = t.event_id join public.organization_members m on m.organization_id = e.organization_id where gm.id = gaming_match_participants.match_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));
grant select, insert, update, delete on public.gaming_match_participants to authenticated;

create policy gaming_scores_member_select on public.gaming_scores for select to authenticated
using (exists (select 1 from public.organization_members m where m.user_id = (select auth.uid())));
grant select on public.gaming_scores to authenticated;
-- gaming_scores solo se escribe desde recalculate_gaming_score() (security definer); sin policy "all" a propósito.

create policy gaming_rewards_member_select on public.gaming_rewards for select to authenticated
using (exists (select 1 from public.gaming_tournaments t join public.gaming_events e on e.id = t.event_id join public.organization_members m on m.organization_id = e.organization_id where t.id = gaming_rewards.tournament_id and m.user_id = (select auth.uid())));
create policy gaming_rewards_member_all on public.gaming_rewards for all to authenticated
using (exists (select 1 from public.gaming_tournaments t join public.gaming_events e on e.id = t.event_id join public.organization_members m on m.organization_id = e.organization_id where t.id = gaming_rewards.tournament_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.gaming_tournaments t join public.gaming_events e on e.id = t.event_id join public.organization_members m on m.organization_id = e.organization_id where t.id = gaming_rewards.tournament_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));
grant select, insert, update, delete on public.gaming_rewards to authenticated;

-- Vistas públicas: única superficie de lectura anónima. Las tablas base quedan cerradas a anon.
create view public.leaderboard_public_view as
select
  p.id as player_id,
  p.display_name,
  p.avatar_url,
  coalesce(s.total_points, 0) as total_points
from public.gaming_players p
left join public.gaming_scores s on s.player_id = p.id
order by coalesce(s.total_points, 0) desc;
grant select on public.leaderboard_public_view to anon, authenticated;

create view public.event_bracket_public_view as
select
  e.id as event_id,
  e.name as event_name,
  e.event_date,
  t.id as tournament_id,
  t.game,
  t.format,
  t.status as tournament_status,
  gm.id as match_id,
  gm.round,
  gm.status as match_status,
  mp.placement,
  p.display_name,
  p.avatar_url
from public.gaming_events e
join public.gaming_tournaments t on t.event_id = e.id
join public.gaming_matches gm on gm.tournament_id = t.id
join public.gaming_match_participants mp on mp.match_id = gm.id
join public.gaming_players p on p.id = mp.player_id;
grant select on public.event_bracket_public_view to anon, authenticated;

create view public.gaming_rewards_public_view as
select
  r.id as reward_id,
  r.description,
  r.fulfilled,
  r.fulfilled_at,
  p.display_name,
  p.avatar_url
from public.gaming_rewards r
join public.gaming_players p on p.id = r.player_id
where r.fulfilled = true;
grant select on public.gaming_rewards_public_view to anon, authenticated;
```

- [ ] **Step 2: Write the migration assertions**

```js
// tests/leaderboard-ops.test.mjs
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
```

- [ ] **Step 3: Run test to verify it fails, then apply migration and re-run**

Run: `npm test`
Expected first run: FAIL — migration file doesn't exist yet, so if you write the test before the migration (`readFile` throws `ENOENT`). Since Step 1 already wrote the migration file, running now should instead PASS if the SQL matches the assertions above.

Apply the migration to the Supabase project (`rhzanxzoqmbxptvxgnfj`) via the Supabase CLI or dashboard SQL editor — this is a real production-adjacent write, confirm with the user before applying to a live project.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: all 5 new assertions in `tests/leaderboard-ops.test.mjs` PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260825120000_create_gaming_leaderboard.sql tests/leaderboard-ops.test.mjs
git commit -m "feat(leaderboard): add gaming leaderboard schema, RLS, and score trigger"
```

---

### Task 3: `discord-verify` Edge Function

**Files:**
- Create: `supabase/functions/discord-verify/index.ts`
- Modify: `tests/leaderboard-ops.test.mjs` (append)

**Interfaces:**
- Consumes: `Deno.env.get("SUPABASE_URL")`, `("SUPABASE_ANON_KEY")`, `("SUPABASE_SERVICE_ROLE_KEY")` (all auto-injected by Supabase), `("DISCORD_BOT_TOKEN")`, `("DISCORD_GUILD_ID")` (set manually — see Task 6 README). Reads/writes `gaming_players.discord_member`, `gaming_players.discord_verified_at` (from Task 2).
- Produces: `POST /functions/v1/discord-verify` → `{ verified: boolean }` on success, `{ error: string }` on failure. Consumed by Task 5's public page after Discord OAuth login.

- [ ] **Step 1: Write the Edge Function**

```ts
// supabase/functions/discord-verify/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://telluscoop.org",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VERIFY_TTL_MS = 10 * 60 * 1000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Sesión requerida" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Sesión inválida" }, 401);

    const discordId = user.user_metadata?.provider_id ?? user.user_metadata?.sub;
    if (!discordId) return json({ error: "Sesión sin identidad de Discord" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: player } = await admin
      .from("gaming_players")
      .upsert(
        {
          discord_id: discordId,
          display_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
          avatar_url: user.user_metadata?.avatar_url ?? null,
        },
        { onConflict: "discord_id" },
      )
      .select("discord_member, discord_verified_at")
      .single();

    const isFresh = player?.discord_verified_at &&
      Date.now() - new Date(player.discord_verified_at).getTime() < VERIFY_TTL_MS;
    if (isFresh) return json({ verified: player.discord_member === true });

    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    const guildId = Deno.env.get("DISCORD_GUILD_ID");
    if (!botToken || !guildId) return json({ error: "Discord todavía no está configurado" }, 503);

    const memberResponse = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
      { headers: { Authorization: `Bot ${botToken}` } },
    );
    if (!memberResponse.ok && memberResponse.status !== 404) {
      return json({ error: "No se pudo verificar la membresía" }, 502);
    }

    const isMember = memberResponse.status === 200;
    await admin
      .from("gaming_players")
      .update({ discord_member: isMember, discord_verified_at: new Date().toISOString() })
      .eq("discord_id", discordId);

    return json({ verified: isMember });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Error de verificación" }, 500);
  }
});
```

- [ ] **Step 2: Append the edge-function assertions**

```js
// append to tests/leaderboard-ops.test.mjs
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
```

- [ ] **Step 3: Run test to verify it fails, then implement**

Run: `npm test`
Expected before Step 1's file exists: FAIL (`ENOENT`). Since Step 1 already wrote the function, running now should PASS.

Deploy: `supabase functions deploy discord-verify --project-ref rhzanxzoqmbxptvxgnfj` (requires `DISCORD_BOT_TOKEN`/`DISCORD_GUILD_ID` secrets set first — see Task 6).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: all 3 new assertions PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/discord-verify/index.ts tests/leaderboard-ops.test.mjs
git commit -m "feat(leaderboard): add discord-verify edge function"
```

---

### Task 4: Admin panel — `ops/leaderboard/`

**Files:**
- Create: `ops/leaderboard/config.js`
- Create: `ops/leaderboard/index.html`
- Create: `ops/leaderboard/app.js`
- Create: `ops/leaderboard/styles.css` (start from `ops/stellar/styles.css`)
- Modify: `tests/leaderboard-ops.test.mjs` (append)

**Interfaces:**
- Consumes: Supabase tables from Task 2 (`gaming_events`, `gaming_tournaments`, `gaming_matches`, `gaming_match_participants`, `gaming_rewards`), `window.calculatePoints` from Task 1 (loaded as an ES module for a live points preview).
- Produces: nothing new consumed by later tasks (Task 5 is independent — it only reads the public views from Task 2).

- [ ] **Step 1: Copy the base stylesheet**

```bash
cp "ops/stellar/styles.css" "ops/leaderboard/styles.css"
```
Then trim/rename any Stellar-specific class names that don't apply (e.g. contract-preview banner styles) — keep the shared shell (`.ops-nav`, form/button/toast primitives, color tokens) intact.

- [ ] **Step 2: Write `config.js`**

```js
// ops/leaderboard/config.js
window.LEADERBOARD_OPS_CONFIG = {
  supabaseUrl: "https://rhzanxzoqmbxptvxgnfj.supabase.co",
  supabasePublishableKey: "sb_publishable_oiVUNWzo3p3SXLdr8in3XQ_zbZJiNd7",
};
```

- [ ] **Step 3: Write `index.html`**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex,nofollow,noarchive" />
  <title>Leaderboard — Admin Tellus</title>
  <link rel="icon" type="image/png" href="/uploads/TellusCooperative%20ICON.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./styles.css?v=20260825-01" />
</head>
<body>
  <div id="app"></div>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.7/dist/umd/supabase.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/lucide@0.468.0/dist/umd/lucide.js"></script>
  <script type="module" src="../../leaderboard/points.mjs"></script>
  <script src="./config.js"></script>
  <script src="./app.js?v=20260825-01"></script>
</body>
</html>
```

- [ ] **Step 4: Write `app.js`**

```js
// ops/leaderboard/app.js
(() => {
  "use strict";
  const cfg = window.LEADERBOARD_OPS_CONFIG;
  const supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  const $app = document.querySelector("#app");
  const PREVIEW = new URLSearchParams(location.search).get("preview") === "1";

  const state = {
    session: null,
    membership: null,
    view: "events",
    events: [],
    tournaments: [],
    matches: [],
    rewards: [],
    activeEventId: null,
    activeTournamentId: null,
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = (d) => d ? new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(new Date(d)) : "—";

  function notify(message, isError) {
    const el = document.createElement("div");
    el.className = `toast${isError ? " toast-error" : ""}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  async function loadMembership() {
    const { data: { session } } = await supabase.auth.getSession();
    state.session = session;
    if (!session) return;
    const { data } = await supabase
      .from("organization_members")
      .select("role, organization_id")
      .eq("user_id", session.user.id)
      .maybeSingle();
    state.membership = data;
  }

  async function loadEvents() {
    const { data, error } = await supabase.from("gaming_events").select("*").order("event_date", { ascending: false });
    if (error) return notify(error.message, true);
    state.events = data ?? [];
  }

  async function createEvent(name, eventDate, location) {
    const { error } = await supabase.from("gaming_events").insert({
      organization_id: state.membership.organization_id,
      name,
      event_date: eventDate || null,
      location: location || null,
    });
    if (error) return notify(error.message, true);
    notify("Evento creado");
    await loadEvents();
    render();
  }

  async function loadTournaments(eventId) {
    const { data, error } = await supabase.from("gaming_tournaments").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
    if (error) return notify(error.message, true);
    state.tournaments = data ?? [];
  }

  async function createTournament(eventId, game, format) {
    const { error } = await supabase.from("gaming_tournaments").insert({ event_id: eventId, game, format });
    if (error) return notify(error.message, true);
    notify("Torneo creado");
    await loadTournaments(eventId);
    render();
  }

  async function loadMatches(tournamentId) {
    const { data, error } = await supabase
      .from("gaming_matches")
      .select("*, gaming_match_participants(*, gaming_players(display_name))")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true });
    if (error) return notify(error.message, true);
    state.matches = data ?? [];
  }

  async function createMatch(tournamentId, round) {
    const { error } = await supabase.from("gaming_matches").insert({ tournament_id: tournamentId, round: round || null });
    if (error) return notify(error.message, true);
    await loadMatches(tournamentId);
    render();
  }

  async function addParticipant(matchId, discordId, displayName, placement) {
    const { data: player, error: playerError } = await supabase
      .from("gaming_players")
      .upsert({ discord_id: discordId, display_name: displayName }, { onConflict: "discord_id" })
      .select("id")
      .single();
    if (playerError) return notify(playerError.message, true);
    const { error } = await supabase.from("gaming_match_participants").insert({ match_id: matchId, player_id: player.id, placement });
    if (error) return notify(error.message, true);
    notify("Jugador agregado");
    await loadMatches(state.activeTournamentId);
    render();
  }

  async function confirmMatch(matchId) {
    if (!confirm("¿Confirmar esta partida? Esto actualiza el puntaje del leaderboard.")) return;
    const { error } = await supabase
      .from("gaming_matches")
      .update({ status: "confirmed", confirmed_by: state.session.user.id, confirmed_at: new Date().toISOString() })
      .eq("id", matchId);
    if (error) return notify(error.message, true);
    notify("Partida confirmada, puntaje actualizado");
    await loadMatches(state.activeTournamentId);
    render();
  }

  async function loadRewards(tournamentId) {
    const { data, error } = await supabase.from("gaming_rewards").select("*, gaming_players(display_name)").eq("tournament_id", tournamentId);
    if (error) return notify(error.message, true);
    state.rewards = data ?? [];
  }

  async function createReward(tournamentId, playerId, description) {
    const { error } = await supabase.from("gaming_rewards").insert({
      tournament_id: tournamentId,
      player_id: playerId,
      description,
      created_by: state.session.user.id,
    });
    if (error) return notify(error.message, true);
    notify("Premio asignado");
    await loadRewards(tournamentId);
    render();
  }

  async function markRewardFulfilled(rewardId) {
    const { error } = await supabase.from("gaming_rewards").update({ fulfilled: true, fulfilled_at: new Date().toISOString() }).eq("id", rewardId);
    if (error) return notify(error.message, true);
    await loadRewards(state.activeTournamentId);
    render();
  }

  function renderLogin() {
    $app.innerHTML = `
      <form id="login-form" class="auth-card">
        <h1>Leaderboard — Admin</h1>
        <input name="email" type="email" placeholder="email" required />
        <input name="password" type="password" placeholder="contraseña" required />
        <button type="submit">Ingresar</button>
      </form>`;
    document.querySelector("#login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const { error } = await supabase.auth.signInWithPassword({ email: fd.get("email"), password: fd.get("password") });
      if (error) return notify(error.message, true);
      await loadMembership();
      await loadEvents();
      render();
    });
  }

  function renderPreview() {
    $app.innerHTML = `<p class="preview-badge">Vista previa — sin datos reales</p>`;
  }

  function render() {
    if (PREVIEW) return renderPreview();
    if (!state.session) return renderLogin();
    if (!state.membership || state.membership.role === "viewer") {
      $app.innerHTML = `<p class="denied">Tu cuenta no tiene permisos de edición sobre el leaderboard.</p>`;
      return;
    }
    $app.innerHTML = `
      <nav class="ops-nav">
        <button data-view="events">Eventos</button>
        <button data-view="tournaments">Torneos</button>
        <button data-view="matches">Partidas</button>
        <button data-view="rewards">Premios</button>
      </nav>
      <section id="view-body"></section>`;
    document.querySelectorAll("[data-view]").forEach((btn) => btn.addEventListener("click", () => { state.view = btn.dataset.view; render(); }));
    renderView();
  }

  function renderView() {
    const body = document.querySelector("#view-body");
    if (!body) return;

    if (state.view === "events") {
      body.innerHTML = `
        <form id="event-form">
          <input name="name" placeholder="Nombre del evento" required />
          <input name="event_date" type="date" />
          <input name="location" placeholder="Lugar" />
          <button type="submit">Crear evento</button>
        </form>
        <ul>${state.events.map((e) => `<li data-id="${e.id}">${esc(e.name)} — ${fmtDate(e.event_date)}</li>`).join("")}</ul>`;
      document.querySelector("#event-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        createEvent(fd.get("name"), fd.get("event_date"), fd.get("location"));
      });
      body.querySelectorAll("li[data-id]").forEach((li) => li.addEventListener("click", async () => {
        state.activeEventId = li.dataset.id;
        await loadTournaments(state.activeEventId);
        state.view = "tournaments";
        render();
      }));
    } else if (state.view === "tournaments") {
      body.innerHTML = `
        <form id="tournament-form">
          <input name="game" placeholder="Juego (ej. Mario Kart 8)" required />
          <select name="format"><option value="elimination">Eliminación</option><option value="heats">Heats</option></select>
          <button type="submit">Crear torneo</button>
        </form>
        <ul>${state.tournaments.map((t) => `<li data-id="${t.id}">${esc(t.game)} — ${t.format} — ${t.status}</li>`).join("")}</ul>`;
      document.querySelector("#tournament-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        createTournament(state.activeEventId, fd.get("game"), fd.get("format"));
      });
      body.querySelectorAll("li[data-id]").forEach((li) => li.addEventListener("click", async () => {
        state.activeTournamentId = li.dataset.id;
        await loadMatches(state.activeTournamentId);
        await loadRewards(state.activeTournamentId);
        state.view = "matches";
        render();
      }));
    } else if (state.view === "matches") {
      body.innerHTML = `
        <button id="new-match">+ Nueva partida</button>
        ${state.matches.map((m) => `
          <div class="match-card" data-id="${m.id}">
            <strong>Partida ${m.round ?? ""} — ${m.status}</strong>
            <ul>${(m.gaming_match_participants ?? []).map((p) => `<li>${esc(p.gaming_players?.display_name ?? p.player_id)} — puesto ${p.placement}</li>`).join("")}</ul>
            <form class="participant-form" data-match="${m.id}">
              <input name="discord_id" placeholder="Discord ID" required />
              <input name="display_name" placeholder="Nombre" />
              <input name="placement" type="number" min="1" placeholder="Puesto" required oninput="this.nextElementSibling.textContent = window.calculatePoints ? window.calculatePoints(Number(this.value)) + ' pts' : ''" />
              <output></output>
              <button type="submit">Agregar</button>
            </form>
            ${m.status !== "confirmed" ? `<button class="confirm-match" data-id="${m.id}">Confirmar</button>` : "✅ confirmada"}
          </div>`).join("")}`;
      document.querySelector("#new-match").addEventListener("click", () => createMatch(state.activeTournamentId));
      body.querySelectorAll(".participant-form").forEach((form) => form.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        addParticipant(form.dataset.match, fd.get("discord_id"), fd.get("display_name"), Number(fd.get("placement")));
      }));
      body.querySelectorAll(".confirm-match").forEach((btn) => btn.addEventListener("click", () => confirmMatch(btn.dataset.id)));
    } else if (state.view === "rewards") {
      body.innerHTML = `
        <form id="reward-form">
          <input name="player_id" placeholder="Player ID" required />
          <input name="description" placeholder="Premio (ej. Ledger Nano)" required />
          <button type="submit">Asignar premio</button>
        </form>
        <ul>${state.rewards.map((r) => `<li data-id="${r.id}">${esc(r.gaming_players?.display_name ?? r.player_id)} — ${esc(r.description)} — ${r.fulfilled ? "entregado" : `<button class="fulfill" data-id="${r.id}">Marcar entregado</button>`}</li>`).join("")}</ul>`;
      document.querySelector("#reward-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        createReward(state.activeTournamentId, fd.get("player_id"), fd.get("description"));
      });
      body.querySelectorAll(".fulfill").forEach((btn) => btn.addEventListener("click", () => markRewardFulfilled(btn.dataset.id)));
    }
  }

  (async function init() {
    await loadMembership();
    if (state.session) await loadEvents();
    render();
  })();
})();
```

- [ ] **Step 5: Append admin-panel assertions**

```js
// append to tests/leaderboard-ops.test.mjs
const app = await readFile(new URL("../ops/leaderboard/app.js", import.meta.url), "utf8");
const page = await readFile(new URL("../ops/leaderboard/index.html", import.meta.url), "utf8");

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
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: all new assertions PASS (7 admin-panel checks + the earlier migration/edge-function ones still passing)

- [ ] **Step 7: Commit**

```bash
git add ops/leaderboard/ tests/leaderboard-ops.test.mjs
git commit -m "feat(leaderboard): add admin panel for events, tournaments, matches, rewards"
```

---

### Task 5: Public leaderboard page — `/leaderboard`

**Files:**
- Create: `leaderboard/index.html`
- Create: `leaderboard/app.js`
- Modify: `vercel.json`
- Modify: `i18n.js`
- Test: `tests/leaderboard-public.test.mjs`

**Interfaces:**
- Consumes: `leaderboard_public_view`, `event_bracket_public_view`, `gaming_rewards_public_view` (Task 2), `discord-verify` (Task 3).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the `/leaderboard` rewrite**

```json
// vercel.json — add as a 5th entry in "rewrites", after "/resources/tools/:slug"
{ "source": "/leaderboard", "destination": "/leaderboard/index.html" }
```
Full resulting `rewrites` array:
```json
[
  { "source": "/brand", "destination": "/brand.html" },
  { "source": "/hub", "destination": "/hub/index.html" },
  { "source": "/resources", "destination": "/resources/index.html" },
  { "source": "/resources/tools/:slug", "destination": "/resources/tool.html" },
  { "source": "/leaderboard", "destination": "/leaderboard/index.html" }
]
```

- [ ] **Step 2: Add `lb*` keys to `i18n.js`**

In the `en` block (`i18n.js`), insert right after `modalError: '...',` (currently the last key before the closing `}` at line 48):
```js
    lbTitle: 'Tellus Gaming Leaderboard', lbSubtitle: 'Cumulative ranking across every Tellus gaming event.',
    lbRank: 'Rank', lbPlayer: 'Player', lbPoints: 'Points',
    lbBracketTitle: 'Latest event', lbRewardsTitle: 'Winners & rewards',
    lbLoginDiscord: 'Sign in with Discord', lbLoginedAs: 'Signed in as',
    lbEmpty: 'No results yet.',
```
In the `es` block, insert right after `modalError: '...',` (currently the last key before the closing `}` at line 96):
```js
    lbTitle: 'Leaderboard Gaming Tellus', lbSubtitle: 'Ranking acumulado cruzando todos los eventos gaming de Tellus.',
    lbRank: 'Puesto', lbPlayer: 'Jugador', lbPoints: 'Puntos',
    lbBracketTitle: 'Último evento', lbRewardsTitle: 'Ganadores y premios',
    lbLoginDiscord: 'Iniciar sesión con Discord', lbLoginedAs: 'Sesión iniciada como',
    lbEmpty: 'Todavía no hay resultados.',
```
Note: `leaderboard/app.js` (Step 4 below) keeps its own small copy of these same strings — `i18n.js` requires the homepage's Babel/React runtime to parse (it contains a JSX component), so the standalone `/leaderboard` page can't load it directly as a plain `<script>`. Extending `i18n.js` keeps one source of truth for future homepage integration (e.g. a nav link) even though the public page's own copy is what actually renders.

- [ ] **Step 3: Write `leaderboard/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tellus Gaming Leaderboard</title>
  <meta name="description" content="Cumulative ranking across every Tellus gaming event — Mario Kart, Smash, and more." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://telluscoop.org/leaderboard" />
  <link rel="icon" type="image/png" href="../uploads/TellusCooperative%20ICON.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --sand: #ECE0CC; --teal: #3F8487; --teal-deep: #2A5A5C; --teal-ink: #1F3536; --clay: #C75A2A;
      --serif: 'Fraunces', Georgia, serif; --sans: 'Inter', -apple-system, sans-serif; --mono: 'JetBrains Mono', monospace;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { background: var(--sand); color: var(--teal-ink); font-family: var(--sans); }
    body { line-height: 1.55; padding: 32px 20px 80px; max-width: 880px; margin: 0 auto; }
    h1 { font-family: var(--serif); font-size: clamp(28px, 5vw, 44px); }
    h2 { font-family: var(--serif); font-size: 22px; margin: 40px 0 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid rgba(31,53,54,0.12); }
    th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--teal-deep); }
    .lb-avatar { width: 24px; height: 24px; border-radius: 50%; vertical-align: middle; margin-right: 8px; }
    #lb-auth button { background: var(--teal); color: white; border: none; border-radius: 8px; padding: 10px 18px; font-size: 14px; cursor: pointer; }
    ul { list-style: none; }
    ul li { padding: 8px 0; border-bottom: 1px solid rgba(31,53,54,0.08); }
  </style>
</head>
<body>
  <main>
    <header>
      <h1 id="lb-title"></h1>
      <p id="lb-subtitle"></p>
      <div id="lb-auth"></div>
    </header>
    <section id="lb-ranking" aria-label="ranking"></section>
    <section>
      <h2 id="lb-bracket-title"></h2>
      <div id="lb-bracket"></div>
    </section>
    <section>
      <h2 id="lb-rewards-title"></h2>
      <div id="lb-rewards"></div>
    </section>
  </main>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.7/dist/umd/supabase.js"></script>
  <script src="./app.js"></script>
</body>
</html>
```

- [ ] **Step 4: Write `leaderboard/app.js`**

```js
// leaderboard/app.js
(() => {
  "use strict";
  const SUPABASE_URL = "https://rhzanxzoqmbxptvxgnfj.supabase.co";
  const SUPABASE_KEY = "sb_publishable_oiVUNWzo3p3SXLdr8in3XQ_zbZJiNd7";
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const STRINGS = {
    en: {
      title: "Tellus Gaming Leaderboard",
      subtitle: "Cumulative ranking across every Tellus gaming event.",
      rank: "Rank", player: "Player", points: "Points",
      bracketTitle: "Latest event", rewardsTitle: "Winners & rewards",
      loginDiscord: "Sign in with Discord", loginedAs: "Signed in as",
      empty: "No results yet.",
    },
    es: {
      title: "Leaderboard Gaming Tellus",
      subtitle: "Ranking acumulado cruzando todos los eventos gaming de Tellus.",
      rank: "Puesto", player: "Jugador", points: "Puntos",
      bracketTitle: "Último evento", rewardsTitle: "Ganadores y premios",
      loginDiscord: "Iniciar sesión con Discord", loginedAs: "Sesión iniciada como",
      empty: "Todavía no hay resultados.",
    },
  };
  const lang = (localStorage.getItem("tellus-lang") || "en").startsWith("es") ? "es" : "en";
  const t = (key) => STRINGS[lang][key] ?? key;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function loadRanking() {
    const { data, error } = await supabase
      .from("leaderboard_public_view")
      .select("*")
      .order("total_points", { ascending: false })
      .limit(50);
    const el = document.querySelector("#lb-ranking");
    if (error || !data?.length) { el.innerHTML = `<p>${t("empty")}</p>`; return; }
    el.innerHTML = `
      <table>
        <thead><tr><th>${t("rank")}</th><th>${t("player")}</th><th>${t("points")}</th></tr></thead>
        <tbody>${data.map((row, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${row.avatar_url ? `<img src="${esc(row.avatar_url)}" alt="" class="lb-avatar" />` : ""}${esc(row.display_name || "—")}</td>
            <td>${row.total_points}</td>
          </tr>`).join("")}</tbody>
      </table>`;
  }

  async function loadLatestBracket() {
    const { data, error } = await supabase
      .from("event_bracket_public_view")
      .select("*")
      .order("event_date", { ascending: false })
      .limit(50);
    const el = document.querySelector("#lb-bracket");
    if (error || !data?.length) { el.innerHTML = `<p>${t("empty")}</p>`; return; }
    const latestEventId = data[0].event_id;
    const rows = data.filter((r) => r.event_id === latestEventId);
    el.innerHTML = `
      <h3>${esc(rows[0].event_name)}</h3>
      <ul>${rows.map((r) => `<li>${esc(r.game)} — ${esc(r.display_name || "—")} — ${r.match_status}${r.placement ? ` (#${r.placement})` : ""}</li>`).join("")}</ul>`;
  }

  async function loadRewards() {
    const { data, error } = await supabase
      .from("gaming_rewards_public_view")
      .select("*")
      .limit(30);
    const el = document.querySelector("#lb-rewards");
    if (error || !data?.length) { el.innerHTML = `<p>${t("empty")}</p>`; return; }
    el.innerHTML = `<ul>${data.map((r) => `<li>${esc(r.display_name || "—")} — ${esc(r.description)}</li>`).join("")}</ul>`;
  }

  function renderAuth(session) {
    const el = document.querySelector("#lb-auth");
    if (!session) {
      el.innerHTML = `<button id="lb-discord-login">${t("loginDiscord")}</button>`;
      document.querySelector("#lb-discord-login").addEventListener("click", () => {
        supabase.auth.signInWithOAuth({ provider: "discord", options: { redirectTo: "https://telluscoop.org/leaderboard" } });
      });
      return;
    }
    el.innerHTML = `<span>${t("loginedAs")} ${esc(session.user.user_metadata?.full_name || session.user.email)}</span>`;
    supabase.functions.invoke("discord-verify", { headers: { Authorization: `Bearer ${session.access_token}` } });
  }

  async function initAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    renderAuth(session);
    supabase.auth.onAuthStateChange((_event, newSession) => renderAuth(newSession));
  }

  document.querySelector("#lb-title").textContent = t("title");
  document.querySelector("#lb-subtitle").textContent = t("subtitle");
  document.querySelector("#lb-bracket-title").textContent = t("bracketTitle");
  document.querySelector("#lb-rewards-title").textContent = t("rewardsTitle");

  loadRanking();
  loadLatestBracket();
  loadRewards();
  initAuth();
})();
```

- [ ] **Step 5: Write the public-page test**

```js
// tests/leaderboard-public.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../leaderboard/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../leaderboard/app.js", import.meta.url), "utf8");
const vercelConfig = await readFile(new URL("../vercel.json", import.meta.url), "utf8");

test("vercel.json rewrites /leaderboard to leaderboard/index.html", () => {
  const rules = JSON.parse(vercelConfig).rewrites;
  assert.ok(rules.some((r) => r.source === "/leaderboard" && r.destination === "/leaderboard/index.html"));
});

test("public page renders the ranking, bracket, rewards, and auth sections", () => {
  assert.match(page, /id="lb-ranking"/);
  assert.match(page, /id="lb-bracket"/);
  assert.match(page, /id="lb-rewards"/);
  assert.match(page, /id="lb-auth"/);
});

test("public page loads the ranking unconditionally, not behind a login gate", () => {
  const initOrder = app.slice(app.indexOf("loadRanking();"), app.indexOf("loadRanking();") + 40);
  assert.match(initOrder, /loadRanking\(\);/);
  assert.doesNotMatch(app, /if\s*\(!session\)[\s\S]{0,120}loadRanking\(\)/);
});

test("public page reads only the public views, never the base gaming tables", () => {
  assert.match(app, /leaderboard_public_view/);
  assert.match(app, /event_bracket_public_view/);
  assert.match(app, /gaming_rewards_public_view/);
  assert.doesNotMatch(app, /from\("gaming_players"\)/);
  assert.doesNotMatch(app, /from\("gaming_scores"\)/);
  assert.doesNotMatch(app, /from\("gaming_rewards"\)/);
});

test("public page is bilingual (en/es)", () => {
  assert.match(app, /en:\s*{/);
  assert.match(app, /es:\s*{/);
});

test("public page never embeds secrets", () => {
  assert.doesNotMatch(app, /service[_-]?role/i);
  assert.doesNotMatch(app, /DISCORD_BOT_TOKEN/);
  assert.doesNotMatch(app, /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\./);
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: all 6 assertions in `tests/leaderboard-public.test.mjs` PASS

- [ ] **Step 7: Commit**

```bash
git add leaderboard/ vercel.json i18n.js tests/leaderboard-public.test.mjs
git commit -m "feat(leaderboard): add public /leaderboard page"
```

---

### Task 6: Manual setup docs — `ops/leaderboard/README.md`

**Files:**
- Create: `ops/leaderboard/README.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Write the README**

```markdown
# Leaderboard Ops

Panel admin del leaderboard gaming de Tellus. Sigue el mismo molde que
`ops/stellar/` — vanilla JS + Supabase, mismo proyecto (`rhzanxzoqmbxptvxgnfj`),
autorización 100% vía RLS/`organization_members` (sin allowlist propio: cualquier
cuenta que ya tiene rol `admin`/`operator`/`finance` en la org Tellus puede
administrar el leaderboard).

## Setup local

`npm run dev` → `http://localhost:8080/ops/leaderboard/?preview=1` para una
vista sin datos reales. `http://localhost:8080/ops/leaderboard/` (sin query)
usa Supabase Auth real — necesitás una cuenta con rol no-`viewer` en la org.

## Setup de producción (pasos manuales, una sola vez)

1. **Aplicar la migración** `supabase/migrations/20260825120000_create_gaming_leaderboard.sql`
   al proyecto `rhzanxzoqmbxptvxgnfj` (CLI o SQL editor del dashboard).
2. **Registrar una Discord Application**: https://discord.com/developers/applications
   → crear app → agregar un Bot → copiar el **bot token** → invitar el bot al
   guild de Tellus con permiso mínimo `View Channels`/`Guild Members Intent`
   habilitado (Bot no se conecta nunca al gateway — solo se usa el token para
   llamadas REST salientes desde `discord-verify`).
3. **Habilitar el provider Discord OAuth** en el dashboard de Supabase (Auth →
   Providers → Discord), usando el client id/secret de la misma Discord
   Application.
4. **Agregar la redirect URL** `https://telluscoop.org/leaderboard` a la
   allowlist de Auth (Auth → URL Configuration → Redirect URLs) — mismo lugar
   donde ya está `https://telluscoop.org/ops/stellar/`.
5. **Configurar secrets del Edge Function** (nunca en `config.js`/`.env.local`/git):
   ```bash
   supabase secrets set DISCORD_BOT_TOKEN=... DISCORD_GUILD_ID=... --project-ref rhzanxzoqmbxptvxgnfj
   ```
6. **Deployar la función**:
   ```bash
   supabase functions deploy discord-verify --project-ref rhzanxzoqmbxptvxgnfj
   ```

## Seguridad

- Cada tabla `gaming_*` tiene RLS; lectura/escritura de staff acotada por
  `organization_members`, igual que `ops/stellar`.
- La única superficie anónima son las vistas `leaderboard_public_view`,
  `event_bracket_public_view`, `gaming_rewards_public_view` — las tablas base
  quedan cerradas a `anon`.
- `discord-verify` nunca confía en membresía enviada por el cliente — siempre
  vuelve a pegarle a la API de Discord con el bot token del lado servidor
  (con cache de 10 minutos en `gaming_players.discord_verified_at` para
  absorber picos de tráfico el día del evento).
```

- [ ] **Step 2: Commit**

```bash
git add ops/leaderboard/README.md
git commit -m "docs(leaderboard): add manual setup steps for Discord + Supabase"
```

---

## Self-Review Notes

- **Spec coverage**: data model (Task 2), public page (Task 5), admin panel (Task 4), Discord login + verification (Tasks 3/5), rewards tracking (Tasks 2/4/5), testing convention (Tasks 1/2/3/4/5), error handling (idempotent trigger via unique constraint + `security definer`/`set search_path`, Discord verify treats failure as "not verified" and never silently grants access, admin writes blocked by RLS for `viewer` role) are all covered. Phases 2 (Discord webhook posts) and 3 (on-chain anchoring) are explicitly out of scope per the spec's own phasing — not included here.
- **Type consistency**: `calculatePoints` (Task 1) and `gaming_points_for_placement` (Task 2) return the same 10/6/3/1 values, cross-checked by a test. `discord_member`/`discord_verified_at` columns (Task 2) match exactly what `discord-verify` (Task 3) reads/writes. `leaderboard_public_view`/`event_bracket_public_view`/`gaming_rewards_public_view` column names (Task 2) match exactly what `leaderboard/app.js` (Task 5) selects.
- **No placeholders**: every step above contains complete, runnable code — no "TBD" or "add appropriate handling."
