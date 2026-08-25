# Gaming Leaderboard — Design

Status: approved, pending implementation plan
Date: 2026-08-24

## Problem

Tellus bought a console and runs Mario Kart / Smash-style tournaments at
in-person Web2 + Web3 events, with prizes (Ledger, hoodies, etc). There's
no way to track a running leaderboard across events, verify a player is a
member of the Tellus Discord, or give the results a tamper-evident record.
Everything today is ad hoc (someone remembers who won).

## Goals

- Public `/leaderboard` page: cross-event cumulative ranking, not just a
  single tournament's bracket.
- Discord login gates participation-linked features; membership in the
  Tellus Discord guild is verified server-side.
- Staff can run a tournament from a tablet at the event (walk-in
  registration) and players can also opt to pre-register online.
- Admin can record match results (elimination rounds or multi-racer
  heats) and the cumulative leaderboard updates automatically.
- Rewards (prizes) are tracked per player/tournament.
- Later: results get anchored on-chain (Stellar, Tellus-custodied) as a
  verifiable public record, and standings post to a Discord channel.

## Non-goals (this phase)

- No player wallets. On-chain anchoring (phase 3) is custodial — no
  player ever needs to hold or connect a Stellar wallet.
- No persistent Discord bot process. This repo is 100% static +
  serverless (Vercel); nothing here runs a 24/7 gateway connection. Where
  the ask implies "a bot", it's implemented as a Discord Application's
  bot token used only for outbound REST calls from a Supabase Edge
  Function — never a running client.
- No points-redemption shop. Rewards are admin-assigned per tournament
  result, not purchased with accumulated points.
- No slash commands / in-Discord interactions in this phase. Could be
  added later as a stateless Interactions-endpoint function; out of
  scope now.

## Phasing

1. **Core** (this spec, full detail): data model, public leaderboard,
   admin dashboard, Discord login + membership gate.
2. Discord webhook posts (live standings to a channel) + rewards
   tracking UI polish. Own spec when phase 1 ships.
3. On-chain anchoring (Stellar, custodial). Own spec when phase 2 ships.

Each phase is independently shippable. Phase 1's schema is designed so
2 and 3 add columns/tables rather than reshaping existing ones.

## Data model

New Supabase tables, same project (`rhzanxzoqmbxptvxgnfj`), same RLS
shape the repo already uses (`organization_members`-scoped admin writes,
see `supabase/migrations/20260716220000_add_program_participants.sql`
and `20260819090000_create_qr_codes.sql`). The public page needs
anonymous reads, which none of the existing tables allow — that's new
for this feature, done via a scoped public view rather than opening the
base tables to `anon`.

- `gaming_players`
  - `id uuid pk`, `discord_id text unique not null`, `display_name text`,
    `avatar_url text`, `stellar_address text null` (unused until phase
    3), `created_at`, `updated_at`
  - Row is created/updated on first Discord login (upsert keyed on
    `discord_id`).
- `gaming_events`
  - `id uuid pk`, `organization_id`, `name text`, `event_date date`,
    `location text`, `created_at`
- `gaming_tournaments`
  - `id uuid pk`, `event_id fk`, `game text` (e.g. "Mario Kart 8"),
    `format text check in ('elimination','heats')`, `status text check
    in ('draft','live','completed')`, `created_at`
- `gaming_matches`
  - `id uuid pk`, `tournament_id fk`, `round int null` (elimination
    only), `next_match_id uuid null fk self` (elimination only — winner
    auto-slots here), `status text check in ('pending','live',
    'confirmed')`, `confirmed_by uuid fk auth.users`, `confirmed_at`
- `gaming_match_participants`
  - `id uuid pk`, `match_id fk`, `player_id fk`, `placement int not
    null` (1 = winner/1st place, works for both a 2-player elimination
    match and an 8-racer heat), `points_awarded int not null default 0`
  - unique (`match_id`, `player_id`)
- `gaming_scores`
  - `player_id fk pk`, `total_points int not null default 0`,
    `updated_at`
  - Not hand-edited. Recomputed by a trigger when a match's status flips
    to `confirmed`, same pattern as `apply_ambassador_rank()` /
    `sync_event_attendance_to_participant()` in
    `20260716225500_automate_ambassador_ranks.sql` — a
    `security definer`, `set search_path = ''` trigger function that
    sums `points_awarded` from confirmed matches into `gaming_scores`.
    Default formula (admin-configurable later, hardcoded constant for
    phase 1): placement 1 → 10 pts, 2 → 6, 3 → 3, participation → 1.
- `gaming_rewards`
  - `id uuid pk`, `player_id fk`, `tournament_id fk`, `description text`
    (e.g. "Ledger Nano", "Poleron Tellus"), `fulfilled bool not null
    default false`, `fulfilled_at`, `created_by uuid fk auth.users`

RLS:
- Base tables: `select`/`all` restricted to `authenticated` members of
  the org via `organization_members`, same as existing ops tables — this
  is where admin dashboard reads/writes go.
- `public.leaderboard_public_view` (and `event_bracket_public_view`):
  `security_invoker = off` view exposing only `display_name`,
  `avatar_url`, `total_points`, tournament/match placements — no
  `discord_id`, no email, no internal ids beyond what's needed to link.
  `grant select on these views to anon, authenticated`. This is the only
  anonymous-read surface; base tables stay closed to `anon`.

## Public page — `/leaderboard`

New `leaderboard/index.html`, rewrite added to `vercel.json` (same shape
as `/hub`). No login required to view. Sections:
- Overall cross-event ranking (from `leaderboard_public_view`).
- Current/most recent event's live bracket or heat standings.
- Past winners + prizes gallery (from `gaming_rewards` joined to public
  view).
- "Iniciar sesión con Discord" — only gates seeing your own linked
  history; viewing the leaderboard itself never requires it.
- Bilingual via existing `i18n.js` dictionary (`en`/`es`), consistent
  with the rest of the marketing site.

## Admin — `ops/leaderboard/`

Same shape as `ops/stellar/` and `ops/social/`: vanilla JS IIFE,
`supabase-js` from CDN, same master-admin allowlist / first-access
convention, own `config.js` with the public Supabase URL + publishable
key, cache-busted `?v=YYYYMMDD-NN` on `app.js`/`styles.css` (tests
enforce the two versions match, same as `tests/stellar-ops.test.mjs`).

Capabilities: create events/tournaments, register walk-in or
pre-registered players into a tournament, run matches (confirm
placements — this flips `gaming_matches.status` to `confirmed` and the
scores trigger recomputes `gaming_scores`), assign/mark rewards
fulfilled.

## Discord integration

- **Login**: Supabase Auth's built-in Discord OAuth provider (enabled in
  the Supabase dashboard, not code) — same mechanic already documented
  for redirect-URL allowlisting in `ops/stellar/README.md`. Add
  `https://telluscoop.org/leaderboard` to the redirect allow list.
  On first login, upsert `gaming_players` from the Discord profile.
- **Membership check**: a new Supabase Edge Function
  (`supabase/functions/discord-verify`, sibling to `luma-events`) holds
  `DISCORD_BOT_TOKEN` and `DISCORD_GUILD_ID` as Supabase secrets — never
  in frontend code. It calls `GET /guilds/{guild_id}/members/{user_id}`
  with the bot token server-side and returns a boolean. This requires
  registering a Discord Application with a bot added to the Tellus
  guild (bot never connects to the gateway — it's a credential holder
  for REST calls only).
- **"Bot shows who's winning"**: when admin confirms a match (phase 2,
  not phase 1), the same or a sibling Edge Function `POST`s an embed to
  a Discord Incoming Webhook URL (`DISCORD_WEBHOOK_URL` secret) with
  current top-N standings. No bot process, no gateway, just an outbound
  webhook call triggered by the admin action.

## On-chain anchoring (phase 3 sketch)

Tellus-custodied Stellar account. When admin confirms a match result,
after phase-1/2 land, a server-side call writes a compact record
(tournament id, match id, placements hash) either as a `manageData`
entry or via a minimal Soroban registry contract — TBD in that phase's
own design doc once phase 1/2 are live and we know real transaction
volume. Public page gets a "verificado on-chain ✅" link to the Stellar
Explorer per confirmed result. No player wallet involved at any point.

## Testing

Following repo convention (static assertions against source, not
runtime tests — see `tests/stellar-ops.test.mjs`,
`tests/social-ops.test.mjs`):
- `tests/leaderboard-ops.test.mjs` — asserts `ops/leaderboard/app.js`
  and `index.html` cache-bust versions match, key admin flows exist in
  source.
- `tests/leaderboard-public.test.mjs` — asserts the public page renders
  the expected sections, `vercel.json` has the `/leaderboard` rewrite.
- A plain `node:test` unit test for the points formula (pure function,
  no Supabase needed) — the one piece of real logic worth testing in
  isolation.

## Error handling

- Discord membership check fails/rate-limits → treat as "not verified",
  show a retry CTA, never silently grant access.
- Match confirmation is the single write that fans out (score trigger,
  later: webhook post, on-chain anchor) — each fan-out step must be
  independently retryable / idempotent (unique constraints prevent
  double-scoring the same match; webhook/anchor calls keyed by match id
  so a retry doesn't double-post or double-anchor).
- Admin dashboard writes are RLS-enforced same as `ops/stellar` — a
  revoked/viewer-role account gets a 403 from Postgres, not a silent
  no-op.

## Secrets (Supabase Edge Function secrets only — never frontend/env in git)

- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `DISCORD_WEBHOOK_URL` (phase 2)
- Stellar custodial signing key (phase 3)

## Open risks

- Discord API rate limits on the membership-check endpoint under event-
  day traffic spikes — mitigate with short-TTL caching of the
  verification result in `gaming_players`.
- Default point formula is a guess; needs a real value from Tellus
  before this feels "final" — shipped as an admin-adjustable constant so
  it isn't a blocker.
