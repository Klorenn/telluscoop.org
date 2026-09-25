create or replace function public.tierly_award_reward(p_tournament_id uuid, p_player_id uuid, p_description text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if not public.tierly_is_admin() then raise exception 'Administrador requerido'; end if;
  if p_description is null or length(trim(p_description)) = 0 then raise exception 'Descripción requerida'; end if;
  insert into public.gaming_rewards (player_id, tournament_id, description, created_by)
  values (p_player_id, p_tournament_id, trim(p_description), (select auth.uid())) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.tierly_award_reward(uuid, uuid, text) from public;
grant execute on function public.tierly_award_reward(uuid, uuid, text) to authenticated;
