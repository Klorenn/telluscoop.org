create or replace function public.tierly_update_event(p_event_id uuid, p_name text, p_event_date date, p_location text, p_luma_url text, p_banner_url text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.tierly_is_admin() then raise exception 'Administrador requerido'; end if;
  update public.gaming_events
  set name = trim(p_name), event_date = p_event_date, location = nullif(trim(p_location), ''),
      luma_url = nullif(trim(p_luma_url), ''), banner_url = nullif(trim(p_banner_url), '')
  where id = p_event_id;
  return found;
end;
$$;
revoke all on function public.tierly_update_event(uuid, text, date, text, text, text) from public;
grant execute on function public.tierly_update_event(uuid, text, date, text, text, text) to authenticated;

drop function if exists public.tierly_admin_events();
create function public.tierly_admin_events()
returns table (event_id uuid, tournament_id uuid, event_name text, event_date date, location text, luma_url text, banner_url text, tournament_status text)
language sql security definer set search_path = '' as $$
  select e.id, t.id, e.name, e.event_date, e.location, e.luma_url, e.banner_url, t.status
  from public.gaming_events e join public.gaming_tournaments t on t.event_id = e.id
  where public.tierly_is_admin() order by e.event_date desc, e.created_at desc;
$$;
revoke all on function public.tierly_admin_events() from public;
grant execute on function public.tierly_admin_events() to authenticated;
