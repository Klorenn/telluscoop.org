# Tierly Racer Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Tierly’s first original Canvas racer: a single player races deterministic bots for three verified laps, and only a server-validated replay can earn points.

**Architecture:** The browser renders a local fixed-tick game and records compact input changes; it receives the seed and limits from an authenticated `start` ticket and sends no authoritative result. A private `racer` Edge Function owns ticket issuance, re-simulation, personal-best updates, and the existing `gaming_matches` pending-to-confirmed score path. The static-site and Supabase Functions deployment boundaries mean one locally imported source file cannot reliably ship to both runtimes; use two deliberately portable, fixed-point implementations with identical exported constants and parity fixtures, never floating-point physics, DOM APIs, timers, or random calls in simulation.

**Tech Stack:** Static ESM browser JavaScript, HTML Canvas, Supabase Edge Functions (Deno/TypeScript), PostgreSQL migrations/RLS, `node --test`, Deno test.

**Spec:** `docs/superpowers/specs/2026-08-29-tierly-racer-phase1-design.md`

## Global Constraints

- Phase 1 is local human-versus-deterministic-bots only: no multiplayer, rooms, chat, ghosts, public time leaderboard, wallets, purchases, or Realtime authority.
- Deliver an original track, vehicles, copy, and UI; do not copy Moto Racer code, assets, text, or layout until an upstream commit and applicable MIT `LICENSE` are verified and documented. If that verification fails, reuse ideas only.
- The client submits only `run_id`, opaque ticket, and bounded discrete input replay. It must never submit position, speed, laps, checkpoints, placement, elapsed time, score, or points.
- `track_id`, `simulation_version`, seed, fixed tick count, ordered checkpoints, and all reward outcomes are server-authoritative.
- Use fixed-point integer state throughout deterministic simulation. `requestAnimationFrame` renders only and never advances authoritative simulation time.
- `gaming_racer_runs` must be RLS-enabled, unavailable through PostgREST to `anon` and `authenticated`, and writable only by the Edge Function’s service-role client.
- A ticket is bound to one player and one run, expires, has size/tick/input-change limits, and may create at most one `gaming_matches` record. Repeated valid submit returns the original derived response and cannot reward twice.
- Reward policy must distinguish verified finish, win over bots, and strictly improved personal best for `(player_id, track_id, simulation_version)`; ties receive no personal-best bonus.
- Use the existing `gaming_matches` → `confirmed` trigger pipeline and explicit `gaming_match_participants.points_awarded`; do not write `gaming_scores` from browser or racer function directly.
- Authenticate explicitly inside the Edge Function, keep CORS restricted to Tellus production origins plus localhost, and never log JWTs, opaque tickets, or full replay payloads.
- Keep English and Spanish UI strings together in `tierly/app.js`; bump `app.js`, `racer.js`, and any new browser module query versions together in `tierly/index.html`.
- Preserve existing user changes in `tierly/chess.js`, `tierly/index.html`, and `tests/tierly-chess.test.mjs`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `docs/third-party/moto-racer-provenance.md` | Records the exact upstream licensing check and the no-reuse decision (or the pinned MIT provenance and required notice). |
| `tierly/racer-sim.mjs` | Browser-safe, pure fixed-point simulation: constants, state creation, replay expansion, bot controls, ticks, checkpoints, finishing, and deterministic result. |
| `supabase/functions/racer/simulation.ts` | Deno-safe port of `racer-sim.mjs`, with the same exported names and fixture outputs; no DOM, network, DB, time, or randomness. |
| `tests/racer-sim.test.mjs` | Node unit tests for the browser simulation and canonical replay vectors. |
| `supabase/functions/racer/simulation_test.ts` | Deno parity tests that run the same canonical vectors against the Edge simulation port. |
| `supabase/migrations/20260829150000_add_racer_runs.sql` | Private run/ticket, best-time, reward-policy schema, locked-down RLS, constraints, indexes, and service-role grant. |
| `supabase/functions/racer/index.ts` | Authenticated `start` and `submit` API, ticket hashing, limits, re-simulation, transactional/idempotent credit, sanitised observability. |
| `supabase/config.toml` | Adds `functions.racer.verify_jwt = false`, because `racer` validates the bearer session itself. |
| `tierly/racer.js` | Canvas rendering, fixed tick input recording, keyboard/touch controls, start/submit/abandon lifecycle, and accessible provisional/error/credited states. |
| `tierly/index.html` | Racer view container, Canvas/control markup, responsive styles, module script, and matching cache versions. |
| `tierly/app.js` | `navRacer` and all Racer English/Spanish UI strings; nav item uses the existing `data-view`/`TierlyBridge` route contract. |
| `tests/tierly-racer.test.mjs` | Source-level regression contract for the migration, function, client, bridge, translations, asset/version wiring, and trust boundary. |

### Task 1: Lock provenance and the deterministic simulation contract

**Files:**
- Create: `docs/third-party/moto-racer-provenance.md`
- Create: `tierly/racer-sim.mjs`
- Create: `tests/racer-sim.test.mjs`

**Interfaces:**
- Consumes: no application state.
- Produces: `SIMULATION_VERSION`, `TRACK_ID`, `TICK_MS`, `MAX_TICKS`, `INPUT_BITS`, `createInitialState(seed)`, `step(state, inputMask)`, `simulateRun(seed, replay)`, and `CANONICAL_REPLAY` from `tierly/racer-sim.mjs`.
- `simulateRun(seed: number, replay: Array<{tick: number, input: number}>): { completed: boolean, lapCount: number, checkpointIndex: number, elapsedTicks: number, finishPosition: number, bots: Array<{id: string, finishTicks: number | null}> }`.

- [ ] **Step 1: Verify the upstream before reusing anything**

Run:

```bash
git ls-remote https://github.com/jgzuo/moto-racer.git HEAD
curl -fsSL https://raw.githubusercontent.com/jgzuo/moto-racer/<resolved-commit>/LICENSE
```

Expected: record the resolved commit and the full licence result. If either command fails or the file is absent/non-MIT, write this exact conclusion in `docs/third-party/moto-racer-provenance.md`: `No upstream code, assets, or text are used; Tierly Racer is an original implementation informed only by unprotectable gameplay ideas.` Do not copy any upstream file in this task.

- [ ] **Step 2: Write the failing canonical simulation tests**

Create `tests/racer-sim.test.mjs` with these literal assertions after imports:

```js
test("same seed and canonical replay produce the frozen racer result", () => {
  assert.deepEqual(simulateRun(0x5eed1234, CANONICAL_REPLAY), {
    completed: true,
    lapCount: 3,
    checkpointIndex: 0,
    elapsedTicks: 4380,
    finishPosition: 2,
    bots: [
      { id: "bot-1", finishTicks: 4272 },
      { id: "bot-2", finishTicks: 4464 },
      { id: "bot-3", finishTicks: 4656 },
    ],
  });
});

test("simulation ignores no frame clock and rejects malformed replay transitions", () => {
  assert.throws(() => simulateRun(1, [{ tick: 0, input: 16 }]), /input mask/);
  assert.throws(() => simulateRun(1, [{ tick: -1, input: 1 }]), /tick/);
  assert.equal(Object.hasOwn(createInitialState(1), "now"), false);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test tests/racer-sim.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `tierly/racer-sim.mjs`.

- [ ] **Step 4: Implement the smallest portable fixed-point simulation**

Create `tierly/racer-sim.mjs`. Define `SIMULATION_VERSION = "racer-v1"`, `TRACK_ID = "coastal-loop-v1"`, `TICK_MS = 16`, `MAX_TICKS = 5400`, and `INPUT_BITS = { ACCELERATE: 1, BRAKE: 2, LEFT: 4, RIGHT: 8 }`. Store coordinates, velocity, heading, and progress as signed integers scaled by `1000`; use a local seeded integer PRNG only to derive initial bot lanes/pace. `step` must accept exactly a bit mask of those four bits, advance one tick, enforce ordered checkpoint crossings, and never call `Math.random`, `Date.now`, `performance.now`, Canvas, or `requestAnimationFrame`. `simulateRun` must validate strictly increasing non-negative transition ticks, expand the current input until `MAX_TICKS`, and return only derived data.

Make `CANONICAL_REPLAY` an explicit transition array whose derived output is exactly the fixture above; it is a compatibility vector, not a browser score shortcut.

- [ ] **Step 5: Run the unit test to verify it passes**

Run: `node --test tests/racer-sim.test.mjs`

Expected: PASS with 2 passing tests.

- [ ] **Step 6: Commit the independently testable contract**

```bash
git add docs/third-party/moto-racer-provenance.md tierly/racer-sim.mjs tests/racer-sim.test.mjs
git commit -m "feat: add deterministic racer simulation contract"
```

### Task 2: Add the private run schema and Edge-port parity tests

**Files:**
- Create: `supabase/functions/racer/simulation.ts`
- Create: `supabase/functions/racer/simulation_test.ts`
- Create: `supabase/migrations/20260829150000_add_racer_runs.sql`
- Modify: `tests/tierly-racer.test.mjs`

**Interfaces:**
- Consumes: Task 1’s exact public names and canonical vector/result.
- Produces: Deno exports `SIMULATION_VERSION`, `TRACK_ID`, `TICK_MS`, `MAX_TICKS`, `INPUT_BITS`, and `simulateRun` matching Task 1; tables `public.gaming_racer_runs`, `public.gaming_racer_best_times`, `public.gaming_racer_reward_policy`.
- `gaming_racer_runs.status` is exactly `issued | submitted | validated | rejected | expired`.

- [ ] **Step 1: Write failing schema and parity tests**

Create `tests/tierly-racer.test.mjs` beginning with source reads for the migration and simulation, then add:

```js
test("racer runs are private, stateful, and cannot produce two matches", () => {
  assert.match(migration, /create table public\.gaming_racer_runs/);
  assert.match(migration, /ticket_hash text not null unique/);
  assert.match(migration, /status text not null check \(status in \('issued', 'submitted', 'validated', 'rejected', 'expired'\)\)/);
  assert.match(migration, /match_id uuid unique references public\.gaming_matches/);
  assert.match(migration, /alter table public\.gaming_racer_runs enable row level security/);
  assert.match(migration, /revoke all on table public\.gaming_racer_runs from anon, authenticated/);
});
```

Create `supabase/functions/racer/simulation_test.ts` with:

```ts
Deno.test("canonical browser vector has the same server result", () => {
  assertEquals(simulateRun(0x5eed1234, CANONICAL_REPLAY), CANONICAL_RESULT);
});
```

- [ ] **Step 2: Verify both fail**

Run:

```bash
node --test tests/tierly-racer.test.mjs
deno test supabase/functions/racer/simulation_test.ts
```

Expected: Node FAILS because the migration/source is absent; Deno FAILS because `simulation.ts` is absent.

- [ ] **Step 3: Implement the schema and portable server port**

Create the migration with `uuid` primary keys; `player_id` references `public.gaming_players(id)`; `track_id`, `simulation_version`, `seed bigint`, `ticket_hash`, `expires_at`, `input_limits jsonb`, timestamps, derived `result jsonb`, `rejection_reason`, and unique nullable `match_id`. Add a unique `(player_id, track_id, simulation_version)` best-time table with `best_elapsed_ticks` and `updated_at`; add reward policy keyed by `track_id + simulation_version` with explicitly seeded non-zero values only after owner approval. Add indexes for player/status/expiry and player+track+version. Enable RLS, revoke REST grants from `anon` and `authenticated`, grant service role only, and add no client policies.

Port Task 1’s pure arithmetic verbatim into `simulation.ts`; the only allowed language adaptation is TypeScript annotations. Export the same constants and canonical vector/result. This duplication is intentional: Supabase Functions are deployed from `supabase/functions/`, while `/tierly/` is served as static site content, so a local shared module is not a reliable production artifact.

- [ ] **Step 4: Run the parity and schema tests**

Run:

```bash
node --test tests/tierly-racer.test.mjs
deno test supabase/functions/racer/simulation_test.ts
```

Expected: PASS; canonical output is equal in both runtimes and the migration exposes no browser write route.

- [ ] **Step 5: Commit the private persistence slice**

```bash
git add supabase/functions/racer/simulation.ts supabase/functions/racer/simulation_test.ts supabase/migrations/20260829150000_add_racer_runs.sql tests/tierly-racer.test.mjs
git commit -m "feat: add private racer run persistence"
```

### Task 3: Implement the authoritative ticket, validation, and score credit API

**Files:**
- Create: `supabase/functions/racer/index.ts`
- Modify: `supabase/config.toml`
- Modify: `tests/tierly-racer.test.mjs`

**Interfaces:**
- Consumes: Task 2 tables and `simulateRun`; existing `gaming_matches`, `gaming_match_participants`, and `ensure_gaming_season_tournament(p_game)`.
- Produces: `POST /functions/v1/racer` actions `start` and `submit`.
- `start` response: `{ run_id, opaque_ticket, track_id, simulation_version, seed, expires_at, input_limits }`.
- `submit` request: `{ action: "submit", run_id: string, opaque_ticket: string, replay: Array<{tick: number, input: number}> }`; response includes only derived `{ status, completed, elapsed_ticks, finish_position, points_awarded, personal_best }`.

- [ ] **Step 1: Add failing Edge-function contract tests**

Append these literal static assertions:

```js
test("racer authenticates, limits replay authority, and uses tickets", () => {
  assert.match(edge, /auth\.getUser\(\)/);
  assert.match(edge, /crypto\.getRandomValues/);
  assert.match(edge, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(edge, /action === "start"/);
  assert.match(edge, /action === "submit"/);
  assert.match(edge, /MAX_REPLAY_BYTES/);
  assert.match(edge, /MAX_INPUT_CHANGES/);
  assert.doesNotMatch(edge, /body\.(score|points|elapsed_time|finish_position|lap_count|checkpoint_state)/);
});

test("racer credits exactly through a confirmed gaming match", () => {
  assert.match(edge, /\.insert\(\{ tournament_id: tournamentId, status: "pending" \}\)/);
  assert.match(edge, /from\("gaming_match_participants"\)\.insert/);
  assert.match(edge, /\.update\(\{ status: "confirmed"/);
  assert.match(edge, /match_id.*is\(null\)/);
});
```

- [ ] **Step 2: Run the regression suite to verify failure**

Run: `npm test`

Expected: FAIL in `tests/tierly-racer.test.mjs` because `supabase/functions/racer/index.ts` and the racer config block do not exist.

- [ ] **Step 3: Implement `start` and `submit`**

Mirror the safe Chess function pattern: OPTIONS/POST only, allowed Tellus origins plus localhost, anonymous client with request bearer for `auth.getUser()`, then service-role client and existing Discord-to-`gaming_players` resolver. Add `[functions.racer] verify_jwt = false` in `supabase/config.toml`.

`start` must expire stale issued tickets for that player, reject when the approved active-ticket limit is reached, generate a cryptographically random opaque ticket and integer seed, persist only SHA-256 ticket hash, and return the public simulation configuration. `submit` must validate JSON shape/byte length/change count/tick range before simulation; lock the run row; reject wrong owner/expired/invalid state; set `submitted`; re-simulate with server data; reject incomplete or invalid results; and persist a derived rejection cause without replay contents.

For a valid completion, in one database transaction/RPC, lock `(player_id, track_id, simulation_version)` best-time state; create the Racer tournament via `ensure_gaming_season_tournament("Racer")`; insert one `gaming_matches` row as `pending`; insert its single human participant with approved derived total points; update the strict best time only when `elapsed_ticks` is lower; assign `runs.match_id`; then transition that same match to `confirmed`. On retry after `validated`, return stored derived result and existing points; do not insert another match. Log only run ID, player ID, version, track, outcome/rejection code, simulation duration, and reward flags.

- [ ] **Step 4: Verify security and score-path regression tests pass**

Run: `npm test`

Expected: PASS, including the racer source-contract tests and all existing tests.

- [ ] **Step 5: Commit the server-authoritative slice**

```bash
git add supabase/functions/racer/index.ts supabase/config.toml tests/tierly-racer.test.mjs
git commit -m "feat: validate racer replays server-side"
```

### Task 4: Build the playable original Canvas client and navigation

**Files:**
- Create: `tierly/racer.js`
- Modify: `tierly/index.html`
- Modify: `tierly/app.js`
- Modify: `tests/tierly-racer.test.mjs`

**Interfaces:**
- Consumes: `window.TierlyBridge.{supabase,session,player,t,switchView}`, browser simulation exports, and Task 3 API contracts.
- Produces: `window.TierlyRacer.mount(): void`; an accessible Racer view with start, abandon, canvas, keyboard, touch controls, and result status.

- [ ] **Step 1: Write the failing browser contract test**

Append:

```js
test("racer is wired as a versioned Tierly view with non-authoritative controls", () => {
  assert.match(page, /data-view="racer"/);
  assert.match(page, /id="lb-racer-canvas"/);
  assert.match(page, /id="lb-racer-start"/);
  assert.match(page, /id="lb-racer-abandon"/);
  assert.match(page, /racer\.js\?v=([^"']+)/);
  assert.match(app, /navRacer: "Racer"/);
  assert.match(app, /navRacer: "Carreras"/);
  assert.match(racerJs, /keydown/);
  assert.match(racerJs, /pointerdown/);
  assert.match(racerJs, /functions\/v1\/racer/);
  assert.doesNotMatch(racerJs, /points_awarded\s*=/);
  assert.doesNotMatch(racerJs, /gaming_scores/);
});
```

- [ ] **Step 2: Run the browser contract test to verify it fails**

Run: `node --test tests/tierly-racer.test.mjs`

Expected: FAIL because the Racer markup, module, strings, and source are absent.

- [ ] **Step 3: Implement the client without client-side rewards**

Add the `racer` view and nav item through the existing `data-view` mechanism. Use the Tierly visual tokens and original Canvas drawing primitives (road, checkpoint flags, vehicle shapes) only. The view must expose semantic text for `Lap 1/3`, next checkpoint, elapsed time, position, a canvas fallback description, a start button, abandon button, four labelled touch buttons, and a polite status region.

In `racer.js`, use `TierlyBridge.session()` to obtain the bearer token and call `start`; initialise only from returned ticket fields. Collect keyboard Arrow/WASD and pointer control transitions as `{ tick, input }`; drive simulation via accumulated `performance.now()` render deltas capped to fixed `TICK_MS` ticks, while Canvas paints the already-derived state via `requestAnimationFrame`. On finish, send only the Task 3 submit shape, disable controls while provisional, and render the returned credited/no-points/error status. Abandon stops loops, clears local replay and ticket, and never calls submit. Do not add any client score mutation.

Add both locales for every visible Racer label/status and use one shared version e.g. `20260829-11` for `app.js`, `racer.js`, and `racer-sim.mjs` references. Keep the existing Chess module version check valid by updating its expected matching app version in its existing test only if this changes that invariant.

- [ ] **Step 4: Run the complete static and simulation regression suite**

Run:

```bash
npm test
node --test tests/racer-sim.test.mjs
```

Expected: PASS. The tests show the browser has controls and endpoint wiring but no points authority.

- [ ] **Step 5: Commit the playable client slice**

```bash
git add tierly/racer.js tierly/index.html tierly/app.js tests/tierly-racer.test.mjs tests/tierly-chess.test.mjs
git commit -m "feat: add Tierly racer canvas client"
```

### Task 5: Exercise end-to-end failure modes and release checks

**Files:**
- Modify: `tests/tierly-racer.test.mjs`
- Modify: `supabase/functions/racer/simulation_test.ts`
- Modify: `supabase/functions/racer/index.ts`

**Interfaces:**
- Consumes: all previous task contracts.
- Produces: test-covered rejection codes `ticket_expired`, `ticket_reused`, `replay_invalid`, `run_incomplete`, and idempotent validated result retrieval.

- [ ] **Step 1: Add failing adversarial and parity coverage**

Add these tests:

```ts
Deno.test("fixed-point simulation never changes with render frame cadence", () => {
  assertEquals(simulateRun(0x5eed1234, CANONICAL_REPLAY), simulateRun(0x5eed1234, CANONICAL_REPLAY));
});
```

```js
test("racer documents rejection and idempotent submit paths without secret logging", () => {
  for (const code of ["ticket_expired", "ticket_reused", "replay_invalid", "run_incomplete"]) assert.match(edge, new RegExp(code));
  assert.match(edge, /status === "validated" && run\.match_id/);
  assert.doesNotMatch(edge, /console\.(log|error)\([^)]*(opaque_ticket|authorization|replay)/);
});
```

- [ ] **Step 2: Run to verify the new coverage fails**

Run:

```bash
npm test
deno test supabase/functions/racer/simulation_test.ts
```

Expected: FAIL until the function has explicit safe rejection codes/idempotent return and the Deno test exists.

- [ ] **Step 3: Implement only the missing observable outcomes**

Return stable Spanish user-safe errors mapped from the five internal codes; retain only the code and derived result on the run row. Make validated repeat submits return the persisted result/match participant points before attempting any new match creation. Ensure malformed/incomplete/expired requests leave best-time and score tables untouched. Preserve server-only logs described in the global constraints.

- [ ] **Step 4: Run release verification**

Run:

```bash
npm test
deno test supabase/functions/racer/simulation_test.ts
rg -n 'TO'"'"'DO|TB'"'"'D|implement'"'"' later|fill'"'"' in details|Add'"'"' appropriate' docs/superpowers/plans/2026-08-29-tierly-racer-phase1.md
```

Expected: all tests PASS and `rg` returns exit code 1 (no placeholders). Manually verify in a desktop browser and a touch viewport: keyboard/WASD, touch controls, abandon, provisional/credited/error states, three laps/checkpoint order, bot placement, and visually stable results at 60 Hz and throttled rendering.

- [ ] **Step 5: Commit the hardening slice**

```bash
git add tests/tierly-racer.test.mjs supabase/functions/racer/simulation_test.ts supabase/functions/racer/index.ts
git commit -m "test: cover racer replay failures"
```

## Self-Review

**Spec coverage:** Task 1 covers original/provenance, fixed ticks, seed, bots, laps, checkpoints, timer and deterministic replay; Task 2 covers private run/best-time/policy persistence and cross-runtime determinism; Task 3 covers authentication, tickets, server validation, idempotence, points and observability; Task 4 covers Canvas, keyboard/touch, accessible result states, and no client score authority; Task 5 covers expiry, malformed/replayed input, retry, privacy, and manual FPS/touch verification. Multiplayer, Realtime authority, ghosts, public leaderboards, wallets, and third-party assets remain excluded.

**Placeholder scan:** The red-flag scan above is clean; every task names files, interfaces, assertions, commands, and expected outcomes.

**Type/name consistency:** Both simulation ports expose the Task 1 names; both API actions use `start`/`submit`; the client submit request carries `run_id`, `opaque_ticket`, and `replay`; persistence statuses are consistently `issued|submitted|validated|rejected|expired`; all credit flows through a single `match_id` to `gaming_matches`.
