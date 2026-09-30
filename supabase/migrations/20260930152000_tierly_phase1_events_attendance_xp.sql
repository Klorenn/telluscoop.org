-- Tierly Fase 1: eventos por comunidad, asistencia general y ledger idempotente.

alter table public.gaming_events
  add column if not exists guild_id text references public.communities(guild_id) on delete cascade,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists timezone text not null default 'America/Santiago',
  add column if not exists status text not null default 'scheduled';

alter table public.gaming_events
  drop constraint if exists gaming_events_status_check;
alter table public.gaming_events
  add constraint gaming_events_status_check
  check (status in ('scheduled', 'live', 'completed', 'cancelled'));
alter table public.gaming_events
  drop constraint if exists gaming_events_time_order_check;
alter table public.gaming_events
  add constraint gaming_events_time_order_check
  check (ends_at is null or starts_at is null or ends_at >= starts_at);
create index if not exists gaming_events_guild_date_idx
  on public.gaming_events(guild_id, event_date desc, starts_at desc);

create table if not exists public.tierly_event_attendance (
  event_id uuid not null references public.gaming_events(id) on delete cascade,
  player_id uuid not null references public.gaming_players(id) on delete cascade,
  registered_at timestamptz not null default now(),
  unregistered_at timestamptz,
  checked_in_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  primary key (event_id, player_id),
  check (unregistered_at is null or unregistered_at >= registered_at),
  check (checked_in_at is null or checked_in_at >= registered_at),
  check (confirmed_at is null or checked_in_at is not null)
);
create index if not exists tierly_event_attendance_player_idx
  on public.tierly_event_attendance(player_id, registered_at desc);

create table if not exists public.tierly_xp_ledger (
  id bigint generated always as identity primary key,
  guild_id text not null references public.communities(guild_id) on delete cascade,
  player_id uuid not null references public.gaming_players(id) on delete cascade,
  event_id uuid references public.gaming_events(id) on delete set null,
  xp integer not null default 0,
  stamps integer not null default 0,
  reason text not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (guild_id, idempotency_key),
  check (xp <> 0 or stamps <> 0),
  check (stamps >= 0)
);
create index if not exists tierly_xp_ledger_player_idx
  on public.tierly_xp_ledger(guild_id, player_id, created_at desc);

alter table public.tierly_event_attendance enable row level security;
alter table public.tierly_xp_ledger enable row level security;

drop policy if exists tierly_event_attendance_read on public.tierly_event_attendance;
create policy tierly_event_attendance_read on public.tierly_event_attendance
  for select to authenticated using (
    exists (
      select 1 from public.gaming_events e
      where e.id = event_id
        and (e.guild_id is not null and public.is_community_admin(e.guild_id)
             or player_id in (select id from public.gaming_players where auth_user_id = (select auth.uid())))
    )
  );

drop policy if exists tierly_xp_ledger_read on public.tierly_xp_ledger;
create policy tierly_xp_ledger_read on public.tierly_xp_ledger
  for select to authenticated using (
    public.is_community_admin(guild_id)
    or player_id in (select id from public.gaming_players where auth_user_id = (select auth.uid()))
  );

grant select on public.tierly_event_attendance, public.tierly_xp_ledger to authenticated;
grant select, insert, update, delete on public.tierly_event_attendance, public.tierly_xp_ledger to service_role;
grant usage, select on all sequences in schema public to service_role;

create or replace function public.tierly_register_event(p_event_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_player uuid;
begin
  select id into v_player from public.gaming_players
    where auth_user_id = (select auth.uid()) and discord_member is true;
  if v_player is null then raise exception 'Se requiere una cuenta Tierly verificada'; end if;
  if not exists (select 1 from public.gaming_events where id = p_event_id and status = 'scheduled') then
    raise exception 'El evento no acepta registros';
  end if;
  insert into public.tierly_event_attendance (event_id, player_id, registered_at, unregistered_at)
    values (p_event_id, v_player, now(), null)
    on conflict (event_id, player_id) do update set unregistered_at = null;
  return true;
end;
$$;

create or replace function public.tierly_unregister_event(p_event_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.tierly_event_attendance a set unregistered_at = now()
  from public.gaming_players p where a.event_id = p_event_id and a.player_id = p.id
    and p.auth_user_id = (select auth.uid()) and a.unregistered_at is null;
  return found;
end;
$$;

create or replace function public.tierly_check_in_event(p_event_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.tierly_event_attendance a set checked_in_at = coalesce(checked_in_at, now())
  from public.gaming_players p where a.event_id = p_event_id and a.player_id = p.id
    and p.auth_user_id = (select auth.uid()) and a.unregistered_at is null;
  return found;
end;
$$;

create or replace function public.tierly_confirm_event_attendance(p_event_id uuid, p_player_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_guild text;
begin
  select guild_id into v_guild from public.gaming_events where id = p_event_id;
  if v_guild is null or not public.is_community_admin(v_guild) then raise exception 'Administrador de comunidad requerido'; end if;
  update public.tierly_event_attendance set confirmed_at = coalesce(confirmed_at, now()), confirmed_by = coalesce(confirmed_by, (select auth.uid()))
    where event_id = p_event_id and player_id = p_player_id and checked_in_at is not null and unregistered_at is null;
  return found;
end;
$$;

revoke all on function public.tierly_register_event(uuid), public.tierly_unregister_event(uuid), public.tierly_check_in_event(uuid), public.tierly_confirm_event_attendance(uuid, uuid) from public, anon;
grant execute on function public.tierly_register_event(uuid), public.tierly_unregister_event(uuid), public.tierly_check_in_event(uuid), public.tierly_confirm_event_attendance(uuid, uuid) to authenticated;
