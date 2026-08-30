-- Private persistence for the Tierly Racer Edge Function.
-- Browser clients never receive direct table access; the function writes with service_role.

create table public.gaming_racer_runs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.gaming_players(id) on delete cascade,
  track_id text not null,
  simulation_version text not null,
  seed bigint not null check (seed >= 0),
  ticket_hash text not null unique,
  status text not null check (status in ('issued', 'submitted', 'validated', 'rejected', 'expired')),
  expires_at timestamptz not null,
  input_limits jsonb not null,
  submitted_at timestamptz,
  validated_at timestamptz,
  expired_at timestamptz,
  result jsonb,
  rejection_reason text,
  match_id uuid unique references public.gaming_matches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger gaming_racer_runs_touch before update on public.gaming_racer_runs
for each row execute function public.touch_updated_at();
create index gaming_racer_runs_player_status_expiry_idx on public.gaming_racer_runs(player_id, status, expires_at);
create index gaming_racer_runs_player_track_version_idx on public.gaming_racer_runs(player_id, track_id, simulation_version);

create table public.gaming_racer_best_times (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.gaming_players(id) on delete cascade,
  track_id text not null,
  simulation_version text not null,
  best_elapsed_ticks int not null check (best_elapsed_ticks > 0),
  run_id uuid references public.gaming_racer_runs(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (player_id, track_id, simulation_version)
);
create index gaming_racer_best_times_player_track_version_idx on public.gaming_racer_best_times(player_id, track_id, simulation_version);

create table public.gaming_racer_reward_policy (
  id uuid primary key default gen_random_uuid(),
  track_id text not null,
  simulation_version text not null,
  finish_points int not null default 10 check (finish_points > 0),
  bot_win_bonus_points int not null default 20 check (bot_win_bonus_points > 0),
  personal_best_bonus_points int not null default 15 check (personal_best_bonus_points > 0),
  max_active_tickets int not null default 3 check (max_active_tickets > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (track_id, simulation_version)
);
create trigger gaming_racer_reward_policy_touch before update on public.gaming_racer_reward_policy
for each row execute function public.touch_updated_at();

insert into public.gaming_racer_reward_policy (
  track_id,
  simulation_version,
  finish_points,
  bot_win_bonus_points,
  personal_best_bonus_points,
  max_active_tickets
) values ('coastal-loop-v1', 'racer-v1', 10, 20, 15, 3);

alter table public.gaming_racer_runs enable row level security;
alter table public.gaming_racer_best_times enable row level security;
alter table public.gaming_racer_reward_policy enable row level security;

revoke all on table public.gaming_racer_runs from anon, authenticated;
revoke all on table public.gaming_racer_best_times from anon, authenticated;
revoke all on table public.gaming_racer_reward_policy from anon, authenticated;

grant all on table public.gaming_racer_runs to service_role;
grant all on table public.gaming_racer_best_times to service_role;
grant all on table public.gaming_racer_reward_policy to service_role;
