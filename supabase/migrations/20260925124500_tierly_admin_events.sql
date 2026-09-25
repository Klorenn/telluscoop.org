create or replace function public.tierly_admin_events()
returns table (event_id uuid, event_name text, event_date date, location text, luma_url text)
language sql security definer set search_path = '' as $$
  select id, name, event_date, location, luma_url from public.gaming_events
  where public.tierly_is_admin() order by event_date desc, created_at desc;
$$;
revoke all on function public.tierly_admin_events() from public;
grant execute on function public.tierly_admin_events() to authenticated;
