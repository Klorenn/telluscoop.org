create or replace function public.tierly_register_for_tournament(p_tournament_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_player uuid; v_status text;
begin
  select id into v_player from public.gaming_players where auth_user_id = (select auth.uid()) and discord_member is true;
  if v_player is null then raise exception 'Primero verifica tu cuenta de Discord en Tierly'; end if;
  select status into v_status from public.gaming_tournaments where id = p_tournament_id;
  if v_status not in ('draft', 'live') then raise exception 'Las inscripciones están cerradas'; end if;
  insert into public.gaming_tournament_registrations (tournament_id, player_id) values (p_tournament_id, v_player) on conflict do nothing;
  return true;
end;
$$;
revoke all on function public.tierly_register_for_tournament(uuid) from public;
grant execute on function public.tierly_register_for_tournament(uuid) to authenticated;
