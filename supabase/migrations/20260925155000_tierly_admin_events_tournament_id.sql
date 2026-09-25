drop function if exists public.tierly_admin_events();
create function public.tierly_admin_events()
returns table (event_id uuid, tournament_id uuid, event_name text, event_date date, location text, luma_url text)
language sql security definer set search_path = '' as $$
  select e.id, t.id, e.name, e.event_date, e.location, e.luma_url
  from public.gaming_events e join public.gaming_tournaments t on t.event_id = e.id
  where public.tierly_is_admin() order by e.event_date desc, e.created_at desc;
$$;
revoke all on function public.tierly_admin_events() from public;
grant execute on function public.tierly_admin_events() to authenticated;
