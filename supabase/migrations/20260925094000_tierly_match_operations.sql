create or replace function public.tierly_admin_matches()
returns table (match_id uuid, tournament_id uuid, event_name text, round int, match_status text, player_id uuid, player_name text, placement int)
language sql security definer set search_path = ''
as $$
  select m.id, t.id, e.name, m.round, m.status, p.id, p.display_name, mp.placement
  from public.gaming_matches m
  join public.gaming_tournaments t on t.id = m.tournament_id
  join public.gaming_events e on e.id = t.event_id
  join public.gaming_match_participants mp on mp.match_id = m.id
  join public.gaming_players p on p.id = mp.player_id
  where public.tierly_is_admin()
  order by e.event_date desc, m.round, m.created_at, mp.placement;
$$;
revoke all on function public.tierly_admin_matches() from public;
grant execute on function public.tierly_admin_matches() to authenticated;

create or replace function public.tierly_confirm_match(p_match_id uuid, p_winner_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_tournament uuid; v_round int; v_total int; v_confirmed int; v_winner_count int; v_next uuid; v_winner uuid; v_index int := 0;
begin
  if not public.tierly_is_admin() then raise exception 'Administrador requerido'; end if;
  select tournament_id into v_tournament from public.gaming_matches where id = p_match_id and status <> 'confirmed' for update;
  if v_tournament is null then raise exception 'Partida no disponible'; end if;
  if not exists (select 1 from public.gaming_match_participants where match_id = p_match_id and player_id = p_winner_id) then raise exception 'Ganador inválido'; end if;
  update public.gaming_match_participants set placement = case when player_id = p_winner_id then 1 else 2 end where match_id = p_match_id;
  select round into v_round from public.gaming_matches where id = p_match_id;
  update public.gaming_matches set status = 'confirmed', confirmed_by = (select auth.uid()), confirmed_at = now() where id = p_match_id;
  select count(*), count(*) filter (where status = 'confirmed') into v_total, v_confirmed from public.gaming_matches where tournament_id = v_tournament and round = v_round;
  if v_total = v_confirmed then
    select count(*) into v_winner_count from public.gaming_match_participants mp join public.gaming_matches m on m.id = mp.match_id where m.tournament_id = v_tournament and m.round = v_round and m.status = 'confirmed' and mp.placement = 1;
    if v_winner_count = 1 then
      update public.gaming_tournaments set status = 'completed' where id = v_tournament;
    elsif not exists (select 1 from public.gaming_matches where tournament_id = v_tournament and round = v_round + 1) then
      insert into public.gaming_matches (tournament_id, round, status) values (v_tournament, v_round + 1, 'pending') returning id into v_next;
      for v_winner in select mp.player_id from public.gaming_match_participants mp join public.gaming_matches m on m.id = mp.match_id where m.tournament_id = v_tournament and m.round = v_round and m.status = 'confirmed' and mp.placement = 1 order by m.created_at loop
        v_index := v_index + 1;
        insert into public.gaming_match_participants (match_id, player_id, placement) values (v_next, v_winner, v_index);
      end loop;
    end if;
  end if;
  return true;
end;
$$;
revoke all on function public.tierly_confirm_match(uuid, uuid) from public;
grant execute on function public.tierly_confirm_match(uuid, uuid) to authenticated;
