create or replace function public.tierly_seed_bracket(p_tournament_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_player uuid; v_index int := 0; v_match uuid; v_count int := 0;
begin
  if not public.tierly_is_admin() then raise exception 'Administrador requerido'; end if;
  if exists (select 1 from public.gaming_matches where tournament_id = p_tournament_id) then raise exception 'El bracket ya fue creado'; end if;
  for v_player in select r.player_id from public.gaming_tournament_registrations r join public.gaming_players p on p.id = r.player_id where r.tournament_id = p_tournament_id and p.discord_member is true order by r.created_at, r.player_id loop
    v_index := v_index + 1;
    if v_index % 2 = 1 then insert into public.gaming_matches (tournament_id, round, status) values (p_tournament_id, 1, 'pending') returning id into v_match; v_count := v_count + 1; end if;
    insert into public.gaming_match_participants (match_id, player_id, placement) values (v_match, v_player, case when v_index % 2 = 1 then 1 else 2 end);
  end loop;
  if v_index < 2 then raise exception 'Se requieren al menos dos inscritos'; end if;
  return v_count;
end;
$$;
revoke all on function public.tierly_seed_bracket(uuid) from public;
grant execute on function public.tierly_seed_bracket(uuid) to authenticated;
