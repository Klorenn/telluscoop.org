drop view if exists public.leaderboard_public_view;
create view public.leaderboard_public_view as
select p.id as player_id, p.username, p.display_name, p.avatar_url, p.discord_member,
       coalesce(s.total_points, 0) as total_points
from public.gaming_players p
left join public.gaming_scores s on s.player_id = p.id
where p.discord_member is true
order by coalesce(s.total_points, 0) desc;
grant select on public.leaderboard_public_view to anon, authenticated;

drop view if exists public.event_bracket_public_view;
create view public.event_bracket_public_view as
select e.id as event_id, e.name as event_name, e.event_date, e.location, e.luma_url,
       t.id as tournament_id, t.game, t.format, t.status as tournament_status,
       gm.id as match_id, gm.round, gm.status as match_status,
       mp.placement, p.id as player_id, p.display_name, p.avatar_url
from public.gaming_events e
join public.gaming_tournaments t on t.event_id = e.id
join public.gaming_matches gm on gm.tournament_id = t.id
join public.gaming_match_participants mp on mp.match_id = gm.id
join public.gaming_players p on p.id = mp.player_id
where p.discord_member is true;
grant select on public.event_bracket_public_view to anon, authenticated;
