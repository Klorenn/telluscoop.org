import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260829150000_add_racer_runs.sql", "utf8");
const simulation = readFileSync("supabase/functions/racer/simulation.ts", "utf8");

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
