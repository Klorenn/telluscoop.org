-- Tierly P1: series recurrentes mínimas. No genera ocurrencias futuras.

create table if not exists public.tierly_event_series (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.communities(guild_id) on delete cascade,
  first_event_id uuid not null unique references public.gaming_events(id) on delete cascade,
  timezone text not null default 'America/Santiago',
  recurrence_rule text not null,
  created_at timestamptz not null default now(),
  check (nullif(trim(timezone), '') is not null),
  check (recurrence_rule in ('weekly', 'monthly'))
);

create index if not exists tierly_event_series_guild_idx
  on public.tierly_event_series(guild_id, created_at desc);

alter table public.tierly_event_series enable row level security;

drop policy if exists tierly_event_series_read on public.tierly_event_series;
create policy tierly_event_series_read on public.tierly_event_series
  for select to authenticated
  using (public.is_community_admin(guild_id));

grant select on public.tierly_event_series to authenticated;
grant select, insert, update, delete on public.tierly_event_series to service_role;

create or replace function public.tierly_create_event_series(
  p_guild_id text,
  p_name text,
  p_event_date date,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_timezone text,
  p_recurrence_rule text,
  p_location text,
  p_luma_url text,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_event uuid;
  v_series uuid;
  v_timezone text := coalesce(nullif(trim(p_timezone), ''), 'America/Santiago');
begin
  if not public.is_community_admin(p_guild_id) then
    raise exception 'Administrador de comunidad requerido';
  end if;
  if nullif(trim(p_name), '') is null then
    raise exception 'El nombre del evento es requerido';
  end if;
  if p_ends_at is not null and p_starts_at is not null and p_ends_at < p_starts_at then
    raise exception 'El horario del evento no es válido';
  end if;
  if p_recurrence_rule not in ('weekly', 'monthly') then
    raise exception 'La regla de recurrencia no es válida';
  end if;

  select id into v_org from public.organizations where slug = 'tellus';
  insert into public.gaming_events (
    organization_id, guild_id, name, event_date, starts_at, ends_at, timezone,
    location, luma_url, description, status
  ) values (
    v_org, p_guild_id, trim(p_name), p_event_date, p_starts_at, p_ends_at, v_timezone,
    nullif(trim(p_location), ''), nullif(trim(p_luma_url), ''), nullif(trim(p_description), ''), 'scheduled'
  ) returning id into v_event;

  insert into public.tierly_event_series (guild_id, first_event_id, timezone, recurrence_rule)
    values (p_guild_id, v_event, v_timezone, p_recurrence_rule)
    returning id into v_series;

  return v_series;
end;
$$;

revoke all on function public.tierly_create_event_series(text, text, date, timestamptz, timestamptz, text, text, text, text, text) from public, anon;
grant execute on function public.tierly_create_event_series(text, text, date, timestamptz, timestamptz, text, text, text, text, text) to authenticated;
