-- Corrige la confirmación de asistencia para otorgar XP y stamp una sola vez.

create or replace function public.tierly_confirm_event_attendance(p_event_id uuid, p_player_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_guild text;
  v_confirmed boolean;
begin
  select guild_id into v_guild
  from public.gaming_events
  where id = p_event_id;

  if v_guild is null or not public.is_community_admin(v_guild) then
    raise exception 'Administrador de comunidad requerido';
  end if;

  update public.tierly_event_attendance
  set confirmed_at = coalesce(confirmed_at, now()),
      confirmed_by = coalesce(confirmed_by, (select auth.uid()))
  where event_id = p_event_id
    and player_id = p_player_id
    and checked_in_at is not null
    and unregistered_at is null
  returning true into v_confirmed;

  if not coalesce(v_confirmed, false) then
    return false;
  end if;

  insert into public.tierly_xp_ledger (
    guild_id,
    player_id,
    event_id,
    xp,
    stamps,
    reason,
    idempotency_key
  ) values (
    v_guild,
    p_player_id,
    p_event_id,
    10,
    1,
    'event_attendance',
    'event-attendance:' || p_event_id::text || ':' || p_player_id::text
  )
  on conflict (guild_id, idempotency_key) do nothing;

  return true;
end;
$$;

revoke all on function public.tierly_confirm_event_attendance(uuid, uuid) from public, anon;
grant execute on function public.tierly_confirm_event_attendance(uuid, uuid) to authenticated;
