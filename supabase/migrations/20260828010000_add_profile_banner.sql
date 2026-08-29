-- Banner de perfil: vivía solo en localStorage del navegador de cada usuario,
-- por eso no se veía en /tierly#u/<username> desde otra sesión. Se persiste
-- en gaming_players y se expone en la vista pública.

alter table public.gaming_players
  add column if not exists banner text,
  add column if not exists banner_fit jsonb;

drop view if exists public.leaderboard_public_view;

create view public.leaderboard_public_view as
select
  p.id as player_id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.bio,
  p.banner,
  p.banner_fit,
  coalesce(sp.season_points, 0) as total_points,
  p.discord_member,
  p.stellar_passport_url,
  p.stellar_passport_name
from public.gaming_players p
left join (
  select mp.player_id, sum(mp.points_awarded) as season_points
  from public.gaming_match_participants mp
  join public.gaming_matches m on m.id = mp.match_id
  join public.gaming_tournaments t on t.id = m.tournament_id
  join public.gaming_events e on e.id = t.event_id
  where m.status = 'confirmed'
    and e.event_date >= public.gaming_season_start()
  group by mp.player_id
) sp on sp.player_id = p.id
order by coalesce(sp.season_points, 0) desc;

grant select on public.leaderboard_public_view to anon, authenticated;
