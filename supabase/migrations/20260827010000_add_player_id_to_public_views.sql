-- Expone player_id (id estable de gaming_players) en las vistas públicas de
-- bracket y rewards, para dejar de matchear al jugador logueado por
-- display_name (frágil: colisiona si dos jugadores comparten nombre).

drop view if exists public.event_bracket_public_view;

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
  p.id as player_id,
  p.display_name,
  p.avatar_url
from public.gaming_events e
join public.gaming_tournaments t on t.event_id = e.id
join public.gaming_matches gm on gm.tournament_id = t.id
join public.gaming_match_participants mp on mp.match_id = gm.id
join public.gaming_players p on p.id = mp.player_id;
grant select on public.event_bracket_public_view to anon, authenticated;

drop view if exists public.gaming_rewards_public_view;

create view public.gaming_rewards_public_view as
select
  r.id as reward_id,
  r.description,
  r.fulfilled,
  r.fulfilled_at,
  p.id as player_id,
  p.display_name,
  p.avatar_url
from public.gaming_rewards r
join public.gaming_players p on p.id = r.player_id
where r.fulfilled = true;
grant select on public.gaming_rewards_public_view to anon, authenticated;
