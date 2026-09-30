-- Tierly V0: inteligencia de presencia, aislada por comunidad de Discord.

create table if not exists public.communities (
  guild_id text primary key,
  name text not null,
  icon_url text,
  installed_at timestamptz not null default now(),
  locale text not null default 'es',
  timezone text not null default 'America/Santiago',
  presence_enabled boolean not null default true,
  retention_days integer not null default 30 check (retention_days > 0),
  session_cap_minutes integer not null default 480 check (session_cap_minutes > 0),
  stale_session_hours integer not null default 12 check (stale_session_hours > 0),
  suggestion_threshold integer not null default 5 check (suggestion_threshold > 0)
);

create table if not exists public.community_admins (
  guild_id text not null references public.communities(guild_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  discord_user_id text,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create table if not exists public.observed_members (
  guild_id text not null references public.communities(guild_id) on delete cascade,
  discord_user_id text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  opted_in boolean not null default false,
  primary key (guild_id, discord_user_id)
);

create table if not exists public.games (
  id bigint generated always as identity primary key,
  canonical_name text not null unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.game_aliases (
  raw_activity_name text primary key,
  game_id bigint not null references public.games(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.play_sessions (
  id bigint generated always as identity primary key,
  guild_id text not null references public.communities(guild_id) on delete cascade,
  discord_user_id text not null,
  game_id bigint not null references public.games(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_heartbeat_at timestamptz not null default now(),
  closed_reason text check (closed_reason in ('normal', 'heartbeat', 'crash', 'timeout')),
  minutes integer generated always as (
    case when ended_at is null then null
    else greatest(0, (extract(epoch from (ended_at - started_at)) / 60)::integer)
    end
  ) stored
);

create unique index if not exists play_sessions_one_open_per_game
  on public.play_sessions (guild_id, discord_user_id, game_id)
  where ended_at is null;

create index if not exists play_sessions_guild_started
  on public.play_sessions (guild_id, started_at desc);

create table if not exists public.daily_game_rollups (
  id bigint generated always as identity primary key,
  guild_id text not null references public.communities(guild_id) on delete cascade,
  game_id bigint not null references public.games(id) on delete cascade,
  day date not null,
  unique_players integer not null default 0 check (unique_players >= 0),
  total_minutes integer not null default 0 check (total_minutes >= 0),
  session_count integer not null default 0 check (session_count >= 0)
);

create unique index if not exists daily_game_rollups_unique
  on public.daily_game_rollups (guild_id, game_id, day);

create table if not exists public.suggested_events (
  id bigint generated always as identity primary key,
  guild_id text not null references public.communities(guild_id) on delete cascade,
  game_id bigint not null references public.games(id) on delete cascade,
  generated_at timestamptz not null default now(),
  window_days integer not null default 7 check (window_days > 0),
  player_count integer not null check (player_count >= 0),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed'))
);

create index if not exists suggested_events_pending
  on public.suggested_events (guild_id, game_id)
  where status = 'pending';

alter table public.communities enable row level security;
alter table public.community_admins enable row level security;
alter table public.observed_members enable row level security;
alter table public.games enable row level security;
alter table public.game_aliases enable row level security;
alter table public.play_sessions enable row level security;
alter table public.daily_game_rollups enable row level security;
alter table public.suggested_events enable row level security;

create or replace function public.is_community_admin(target_guild text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_admins
    where guild_id = target_guild and user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_community_admin(text) from public;
grant execute on function public.is_community_admin(text) to authenticated;

drop policy if exists communities_read on public.communities;
drop policy if exists community_admins_read on public.community_admins;
drop policy if exists observed_members_read on public.observed_members;
drop policy if exists games_read on public.games;
drop policy if exists game_aliases_read on public.game_aliases;
drop policy if exists play_sessions_read on public.play_sessions;
drop policy if exists daily_game_rollups_read on public.daily_game_rollups;
drop policy if exists suggested_events_read on public.suggested_events;

create policy communities_read on public.communities
  for select to authenticated using (public.is_community_admin(guild_id));
create policy community_admins_read on public.community_admins
  for select to authenticated using (user_id = (select auth.uid()));
create policy observed_members_read on public.observed_members
  for select to authenticated using (public.is_community_admin(guild_id));
create policy games_read on public.games
  for select to authenticated using (exists (
    select 1 from public.community_admins ca
    where ca.user_id = (select auth.uid())
  ));
create policy game_aliases_read on public.game_aliases
  for select to authenticated using (exists (
    select 1 from public.community_admins ca
    where ca.user_id = (select auth.uid())
  ));
create policy play_sessions_read on public.play_sessions
  for select to authenticated using (public.is_community_admin(guild_id));
create policy daily_game_rollups_read on public.daily_game_rollups
  for select to authenticated using (public.is_community_admin(guild_id));
create policy suggested_events_read on public.suggested_events
  for select to authenticated using (public.is_community_admin(guild_id));

grant select, insert, update, delete on
  public.communities, public.community_admins, public.observed_members,
  public.games, public.game_aliases, public.play_sessions,
  public.daily_game_rollups, public.suggested_events
to service_role;
