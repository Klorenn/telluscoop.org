-- Las zonas se validan en servidor y se heredan de la comunidad cuando no se especifican.
create or replace function public.tierly_create_event(
  p_guild_id text, p_name text, p_event_date date, p_starts_at timestamptz,
  p_ends_at timestamptz, p_timezone text, p_location text, p_luma_url text,
  p_description text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_event uuid; v_org uuid; v_timezone text;
begin
  if not public.is_community_admin(p_guild_id) then raise exception 'Administrador de comunidad requerido'; end if;
  select coalesce(nullif(trim(p_timezone), ''), c.timezone) into v_timezone from public.communities c where c.guild_id = p_guild_id;
  if v_timezone is null or not exists (select 1 from pg_timezone_names where name = v_timezone) then raise exception 'La zona horaria no es válida'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'El nombre del evento es requerido'; end if;
  if p_ends_at is not null and p_starts_at is not null and p_ends_at < p_starts_at then raise exception 'El horario del evento no es válido'; end if;
  select id into v_org from public.organizations where slug = 'tellus';
  insert into public.gaming_events (organization_id, guild_id, name, event_date, starts_at, ends_at, timezone, location, luma_url, description, status)
    values (v_org, p_guild_id, trim(p_name), p_event_date, p_starts_at, p_ends_at, v_timezone, nullif(trim(p_location), ''), nullif(trim(p_luma_url), ''), nullif(trim(p_description), ''), 'scheduled')
    returning id into v_event;
  return v_event;
end;
$$;
