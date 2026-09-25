create or replace function public.tierly_admin_players()
returns table (player_id uuid, display_name text, username text, discord_id text)
language sql security definer set search_path = ''
as $$
  select id, coalesce(display_name, username, 'Jugador'), username, discord_id
  from public.gaming_players
  where public.tierly_is_admin() and discord_id not like 'walkin-%'
  order by lower(coalesce(display_name, username, ''));
$$;
revoke all on function public.tierly_admin_players() from public;
grant execute on function public.tierly_admin_players() to authenticated;

create or replace function public.tierly_create_smash_tournament(
  p_name text, p_event_date date, p_location text, p_players jsonb
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_org uuid; v_event uuid; v_tournament uuid; v_match uuid; v_player jsonb; v_player_id uuid; v_index int := 0;
begin
  if not public.tierly_is_admin() then raise exception 'Administrador requerido'; end if;
  if jsonb_array_length(p_players) < 2 then raise exception 'Se requieren al menos dos jugadores registrados'; end if;
  select id into v_org from public.organizations where slug = 'tellus';
  insert into public.gaming_events (organization_id, name, event_date, location) values (v_org, p_name, p_event_date, coalesce(p_location, '')) returning id into v_event;
  insert into public.gaming_tournaments (event_id, game, format) values (v_event, 'Super Smash Bros.', 'elimination') returning id into v_tournament;
  for v_player in select value from jsonb_array_elements(p_players) loop
    v_index := v_index + 1;
    if v_index % 2 = 1 then insert into public.gaming_matches (tournament_id, round, status) values (v_tournament, 1, 'pending') returning id into v_match; end if;
    v_player_id := (v_player->>'player_id')::uuid;
    if not exists (select 1 from public.gaming_players where id = v_player_id and discord_id not like 'walkin-%') then raise exception 'Solo se permiten jugadores registrados'; end if;
    insert into public.gaming_match_participants (match_id, player_id, placement) values (v_match, v_player_id, case when v_index % 2 = 1 then 1 else 2 end);
  end loop;
  return v_tournament;
end;
$$;
revoke all on function public.tierly_create_smash_tournament(text, date, text, jsonb) from public;
grant execute on function public.tierly_create_smash_tournament(text, date, text, jsonb) to authenticated;
