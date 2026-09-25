alter table public.gaming_players add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

create table if not exists public.gaming_tournament_registrations (
  tournament_id uuid not null references public.gaming_tournaments(id) on delete cascade,
  player_id uuid not null references public.gaming_players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tournament_id, player_id)
);
alter table public.gaming_tournament_registrations enable row level security;
create policy gaming_registration_public_select on public.gaming_tournament_registrations for select to anon, authenticated using (true);
grant select on public.gaming_tournament_registrations to anon, authenticated;

create or replace function public.tierly_register_for_tournament(p_tournament_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_player uuid;
begin
  select id into v_player from public.gaming_players where auth_user_id = (select auth.uid()) and discord_member is true;
  if v_player is null then raise exception 'Se requiere una cuenta Tierly verificada'; end if;
  if not exists (select 1 from public.gaming_tournaments where id = p_tournament_id and status = 'draft') then raise exception 'El torneo no acepta inscripciones'; end if;
  insert into public.gaming_tournament_registrations (tournament_id, player_id) values (p_tournament_id, v_player) on conflict do nothing;
  return true;
end;
$$;
revoke all on function public.tierly_register_for_tournament(uuid) from public;
grant execute on function public.tierly_register_for_tournament(uuid) to authenticated;

create or replace function public.tierly_unregister_from_tournament(p_tournament_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  delete from public.gaming_tournament_registrations r using public.gaming_players p where r.tournament_id = p_tournament_id and r.player_id = p.id and p.auth_user_id = (select auth.uid());
  return found;
end;
$$;
revoke all on function public.tierly_unregister_from_tournament(uuid) from public;
grant execute on function public.tierly_unregister_from_tournament(uuid) to authenticated;
