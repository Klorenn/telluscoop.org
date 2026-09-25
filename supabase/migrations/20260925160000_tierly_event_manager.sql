create or replace function public.tierly_delete_event(p_event_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.tierly_is_admin() then raise exception 'Administrador requerido'; end if;
  delete from public.gaming_events where id = p_event_id;
  return found;
end;
$$;
revoke all on function public.tierly_delete_event(uuid) from public;
grant execute on function public.tierly_delete_event(uuid) to authenticated;

create or replace function public.tierly_set_tournament_status(p_tournament_id uuid, p_status text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.tierly_is_admin() then raise exception 'Administrador requerido'; end if;
  if p_status not in ('draft', 'live', 'completed') then raise exception 'Estado inválido'; end if;
  update public.gaming_tournaments set status = p_status where id = p_tournament_id;
  return found;
end;
$$;
revoke all on function public.tierly_set_tournament_status(uuid, text) from public;
grant execute on function public.tierly_set_tournament_status(uuid, text) to authenticated;
