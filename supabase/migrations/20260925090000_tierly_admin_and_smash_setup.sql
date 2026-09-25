-- Mantiene la cuenta operadora de Tierly como administradora y expone solo
-- una comprobación mínima para que el panel no dependa de datos internos.
insert into private.admin_allowlist (email, organization_id, role)
select 'kohcuendepau@gmail.com', id, 'admin'::public.member_role
from public.organizations
where slug = 'tellus'
on conflict (email) do update set organization_id = excluded.organization_id, role = excluded.role;

insert into public.organization_members (organization_id, user_id, role)
select o.id, u.id, 'admin'::public.member_role
from public.organizations o
join auth.users u on lower(u.email) = 'kohcuendepau@gmail.com'
where o.slug = 'tellus'
on conflict (organization_id, user_id) do update set role = excluded.role;

create or replace function public.tierly_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    join auth.users u on u.id = m.user_id
    where m.user_id = (select auth.uid())
      and m.role = 'admin'
      and o.slug = 'tellus'
      and lower(u.email) = 'kohcuendepau@gmail.com'
  );
$$;
revoke all on function public.tierly_is_admin() from public;
grant execute on function public.tierly_is_admin() to authenticated;

create or replace function public.tierly_create_smash_tournament(
  p_name text,
  p_event_date date,
  p_location text,
  p_players jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_event uuid;
  v_tournament uuid;
  v_match uuid;
  v_player jsonb;
  v_player_id uuid;
  v_index int := 0;
  v_first uuid;
begin
  if not public.tierly_is_admin() then raise exception 'Administrador requerido'; end if;
  if jsonb_array_length(p_players) < 2 then raise exception 'Se requieren al menos dos jugadores'; end if;
  select id into v_org from public.organizations where slug = 'tellus';
  insert into public.gaming_events (organization_id, name, event_date, location)
    values (v_org, p_name, p_event_date, coalesce(p_location, '')) returning id into v_event;
  insert into public.gaming_tournaments (event_id, game, format)
    values (v_event, 'Super Smash Bros.', 'elimination') returning id into v_tournament;
  for v_player in select value from jsonb_array_elements(p_players) loop
    v_index := v_index + 1;
    if v_index % 2 = 1 then
      insert into public.gaming_matches (tournament_id, round, status) values (v_tournament, 1, 'pending') returning id into v_match;
    end if;
    insert into public.gaming_players (discord_id, display_name) values ('walkin-' || gen_random_uuid()::text, v_player->>'display_name') returning id into v_player_id;
    insert into public.gaming_match_participants (match_id, player_id, placement) values (v_match, v_player_id, case when v_index % 2 = 1 then 1 else 2 end);
  end loop;
  return v_tournament;
end;
$$;
revoke all on function public.tierly_create_smash_tournament(text, date, text, jsonb) from public;
grant execute on function public.tierly_create_smash_tournament(text, date, text, jsonb) to authenticated;
