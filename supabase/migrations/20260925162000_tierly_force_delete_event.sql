create or replace function public.tierly_delete_event(p_event_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_tournament uuid;
begin
  if not public.tierly_is_admin() then raise exception 'Administrador requerido'; end if;
  select id into v_tournament from public.gaming_tournaments where event_id = p_event_id limit 1;
  if v_tournament is null then
    delete from public.gaming_events where id = p_event_id;
    return found;
  end if;
  delete from public.gaming_rewards where tournament_id = v_tournament;
  delete from public.gaming_match_participants where match_id in (select id from public.gaming_matches where tournament_id = v_tournament);
  delete from public.gaming_matches where tournament_id = v_tournament;
  delete from public.gaming_tournament_registrations where tournament_id = v_tournament;
  delete from public.gaming_tournaments where id = v_tournament;
  delete from public.gaming_events where id = p_event_id;
  return found;
end;
$$;
revoke all on function public.tierly_delete_event(uuid) from public;
grant execute on function public.tierly_delete_event(uuid) to authenticated;
