drop function if exists public.tierly_admin_events();
create function public.tierly_admin_events()
returns table (event_id uuid, tournament_id uuid, event_name text, event_date date, location text, luma_url text, banner_url text, tournament_status text, registration_count bigint)
language sql security definer set search_path = '' as $$
  select e.id, t.id, e.name, e.event_date, e.location, e.luma_url, e.banner_url, t.status,
         (select count(*) from public.gaming_tournament_registrations r where r.tournament_id = t.id)
  from public.gaming_events e join public.gaming_tournaments t on t.event_id = e.id
  where public.tierly_is_admin() order by e.event_date desc, e.created_at desc;
$$;
revoke all on function public.tierly_admin_events() from public;
grant execute on function public.tierly_admin_events() to authenticated;

drop view if exists public.gaming_events_catalog_public_view;
create view public.gaming_events_catalog_public_view as
select e.id as event_id, e.name as event_name, e.event_date, e.location, e.luma_url, e.banner_url,
       t.id as tournament_id, t.game, t.format, t.status as tournament_status,
       (select count(*) from public.gaming_tournament_registrations r where r.tournament_id = t.id) as registration_count,
       coalesce((select jsonb_agg(jsonb_build_object('player_id', p.id, 'display_name', p.display_name) order by r.created_at)
                 from public.gaming_tournament_registrations r join public.gaming_players p on p.id = r.player_id
                 where r.tournament_id = t.id and p.discord_member is true), '[]'::jsonb) as registered_players
from public.gaming_events e join public.gaming_tournaments t on t.event_id = e.id
order by e.event_date desc;
grant select on public.gaming_events_catalog_public_view to anon, authenticated;
