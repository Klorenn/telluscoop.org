import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260829150000_add_racer_runs.sql", "utf8");
const atomicMigration = readFileSync("supabase/migrations/20260830183000_add_racer_atomic_rpcs.sql", "utf8");
const simulation = readFileSync("supabase/functions/racer/simulation.ts", "utf8");
const edge = readFileSync("supabase/functions/racer/index.ts", "utf8");
const supabaseConfig = readFileSync("supabase/config.toml", "utf8");

test("racer runs are private, stateful, and cannot produce two matches", () => {
  assert.match(migration, /create table public\.gaming_racer_runs/);
  assert.match(migration, /ticket_hash text not null unique/);
  assert.match(migration, /status text not null check \(status in \('issued', 'submitted', 'validated', 'rejected', 'expired'\)\)/);
  assert.match(migration, /match_id uuid unique references public\.gaming_matches/);
  for (const table of ["gaming_racer_runs", "gaming_racer_best_times", "gaming_racer_reward_policy"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`));
    assert.match(migration, new RegExp(`grant all on table public\\.${table} to service_role`));
    assert.doesNotMatch(migration, new RegExp(`grant .*public\\.${table} to (anon|authenticated)`));
  }
  assert.doesNotMatch(migration, /create policy gaming_racer_/);
});

test("racer reward policy captures the owner-approved non-zero awards and ticket cap", () => {
  assert.match(migration, /finish_points int not null default 10 check \(finish_points > 0\)/);
  assert.match(migration, /bot_win_bonus_points int not null default 20 check \(bot_win_bonus_points > 0\)/);
  assert.match(migration, /personal_best_bonus_points int not null default 15 check \(personal_best_bonus_points > 0\)/);
  assert.match(migration, /max_active_tickets int not null default 3 check \(max_active_tickets > 0\)/);
  assert.match(migration, /values \('coastal-loop-v1', 'racer-v1', 10, 20, 15, 3\)/);
});

test("server simulation exports the browser parity contract without ambient authority", () => {
  for (const name of ["SIMULATION_VERSION", "TRACK_ID", "TICK_MS", "MAX_TICKS", "INPUT_BITS", "simulateRun"]) {
    assert.match(simulation, new RegExp(`export (const|function) ${name}`));
  }
  assert.match(simulation, /export const CANONICAL_RESULT/);
  assert.doesNotMatch(simulation, /Math\.random|Date\.now|performance\.now|requestAnimationFrame|document|window|fetch\(/);
});

test("racer best times use the standard updated_at touch trigger", () => {
  assert.match(migration, /create trigger gaming_racer_best_times_touch before update on public\.gaming_racer_best_times/);
  assert.match(migration, /for each row execute function public\.touch_updated_at\(\)/);
});

test("racer authenticates, limits replay authority, and uses tickets", () => {
  assert.match(supabaseConfig, /\[functions\.racer\][\s\S]*?verify_jwt\s*=\s*false/);
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
  assert.match(edge, /rpc\("issue_gaming_racer_run"/);
  assert.match(edge, /rpc\("claim_gaming_racer_run"/);
  assert.match(edge, /rpc\("finalize_gaming_racer_run"/);
  assert.match(edge, /rpc\("reject_gaming_racer_run"/);
  assert.doesNotMatch(edge, /from\("gaming_matches"\)/);
  assert.doesNotMatch(edge, /from\("gaming_match_participants"\)/);
  assert.doesNotMatch(edge, /from\("gaming_racer_best_times"\)/);
  assert.doesNotMatch(edge, /\.upsert\(\{[^}]*status: "pending"/);
});

test("racer start and submit are serialized in security definer RPCs", () => {
  assert.match(atomicMigration, /create or replace function public\.issue_gaming_racer_run\(/);
  assert.match(atomicMigration, /create or replace function public\.claim_gaming_racer_run\(/);
  assert.match(atomicMigration, /create or replace function public\.finalize_gaming_racer_run\(/);
  assert.match(atomicMigration, /create or replace function public\.reject_gaming_racer_run\(/);
  assert.match(atomicMigration, /security definer/g);
  assert.match(atomicMigration, /set search_path = ''/g);
  assert.match(atomicMigration, /pg_advisory_xact_lock\(hashtextextended\(p_player_id::text, 0\)\)/);
  assert.match(atomicMigration, /for update/);
  assert.match(atomicMigration, /max_active_tickets/);
  assert.match(atomicMigration, /elapsed_ticks < v_best\.best_elapsed_ticks/);
  assert.match(atomicMigration, /public\.ensure_gaming_season_tournament\('Racer'\)/);
  assert.match(atomicMigration, /insert into public\.gaming_matches[\s\S]*status\)[\s\S]*values[\s\S]*'pending'/);
  assert.match(atomicMigration, /insert into public\.gaming_match_participants/);
  assert.match(atomicMigration, /update public\.gaming_matches[\s\S]*status = 'confirmed'/);
  assert.match(atomicMigration, /revoke all on function public\.finalize_gaming_racer_run/);
  assert.match(atomicMigration, /grant execute on function public\.finalize_gaming_racer_run[\s\S]*to service_role/);
});
