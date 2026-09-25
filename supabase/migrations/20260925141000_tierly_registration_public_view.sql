drop view if exists public.event_bracket_public_view;
create view public.event_bracket_public_view as
select e.id as event_id, e.name as event_name, e.event_date, e.location, e.luma_url,
       t.id as tournament_id, t.game, t.format, t.status as tournament_status,
       (select count(*) from public.gaming_tournament_registrations r where r.tournament_id = t.id) as registration_count,
       gm.id as match_id, gm.round, gm.status as match_status,
       mp.placement, p.id as player_id, p.display_name, p.avatar_url
from public.gaming_events e
join public.gaming_tournaments t on t.event_id = e.id
join public.gaming_matches gm on gm.tournament_id = t.id
join public.gaming_match_participants mp on mp.match_id = gm.id
join public.gaming_players p on p.id = mp.player_id
where p.discord_member is true;
grant select on public.event_bracket_public_view to anon, authenticated;
