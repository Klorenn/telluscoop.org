-- Temporadas de 6 meses: el ranking público se resetea cada 6 meses desde el
-- ancla 2026-08-27. gaming_scores/gaming_match_participants no se tocan (se
-- guarda todo el historial); el filtro por temporada vive en el view público,
-- calculado en vivo — así no hace falta cron ni estado que se pueda desincronizar.

create or replace function public.gaming_season_start(as_of date default current_date)
returns date
language sql
stable
set search_path = ''
as $$
  select (date '2026-08-27' + (
    (floor(
      (extract(year from age(as_of, date '2026-08-27')) * 12
        + extract(month from age(as_of, date '2026-08-27'))) / 6
    ))::int * 6
  ) * interval '1 month')::date;
$$;

drop view if exists public.leaderboard_public_view;

create view public.leaderboard_public_view as
select
  p.id as player_id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.bio,
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
