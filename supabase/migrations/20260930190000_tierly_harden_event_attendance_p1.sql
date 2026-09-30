-- P1: restringe el ciclo de asistencia a estados, ventana y transiciones válidas.

create or replace function public.tierly_register_event(p_event_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_player uuid;
  v_confirmed_at timestamptz;
begin
  select id into v_player
  from public.gaming_players
  where auth_user_id = (select auth.uid()) and discord_member is true;
  if v_player is null then
    raise exception 'Se requiere una cuenta Tierly verificada';
  end if;

  if not exists (
    select 1 from public.gaming_events
    where id = p_event_id and status = 'scheduled'
  ) then
    raise exception 'El evento no acepta registros';
  end if;

  select confirmed_at into v_confirmed_at
  from public.tierly_event_attendance
  where event_id = p_event_id and player_id = v_player
  for update;
  if v_confirmed_at is not null then
    raise exception 'La asistencia ya fue confirmada';
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
  update public.tierly_event_attendance a
  set unregistered_at = now()
  from public.gaming_players p
  where a.event_id = p_event_id
    and a.player_id = p.id
    and p.auth_user_id = (select auth.uid())
    and a.unregistered_at is null
    and a.checked_in_at is null
    and a.confirmed_at is null;
  return found;
end;
$$;

create or replace function public.tierly_check_in_event(p_event_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1
    from public.gaming_events
    where id = p_event_id
      and status in ('scheduled', 'live')
      and starts_at is not null
      and ends_at is not null
      and now() between starts_at and ends_at
  ) then
    raise exception 'El check-in solo está disponible durante la ventana del evento';
  end if;

  update public.tierly_event_attendance a
  set checked_in_at = coalesce(checked_in_at, now())
  from public.gaming_players p
  where a.event_id = p_event_id
    and a.player_id = p.id
    and p.auth_user_id = (select auth.uid())
    and a.unregistered_at is null;
  return found;
end;
$$;

revoke all on function public.tierly_register_event(uuid), public.tierly_unregister_event(uuid), public.tierly_check_in_event(uuid) from public, anon;
grant execute on function public.tierly_register_event(uuid), public.tierly_unregister_event(uuid), public.tierly_check_in_event(uuid) to authenticated;
