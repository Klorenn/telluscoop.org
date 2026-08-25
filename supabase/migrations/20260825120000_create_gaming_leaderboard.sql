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
