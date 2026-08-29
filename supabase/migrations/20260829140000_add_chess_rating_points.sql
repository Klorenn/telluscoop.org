-- supabase/migrations/20260829140000_add_chess_rating_points.sql
-- Sistema de puntaje por partida + rating Elo de ajedrez para Tierly.
--
-- Cambio de modelo: los puntos dejan de salir SOLO de la tabla placement
-- (10/6/3/1). El edge function de chess ahora calcula puntos explícitos por
-- dificultad (bot easy=10, medium=20, hard=25), PvP (25 + racha hasta +10),
-- empate (3 o 5) y derrota (1), y los escribe en points_awarded al insertar
-- el participante. El trigger ya no los pisa: solo rellena con la fórmula
-- legacy cuando points_awarded está en 0 (flujos de eventos offline).

alter table public.gaming_chess_games
  add column if not exists match_id uuid references public.gaming_matches(id) on delete set null;

-- El match guarda cómo quedó cada jugador (puntos + rating antes/después) para
-- que "state" pueda reconstruir el resumen de una partida ya terminada.
alter table public.gaming_match_participants
  add column if not exists rating_before int,
  add column if not exists rating_after int;

create table public.gaming_chess_ratings (
  player_id uuid primary key references public.gaming_players(id) on delete cascade,
  rating int not null default 1200 check (rating > 0),
  best_rating int not null default 1200,
  games_played int not null default 0 check (games_played >= 0),
  wins int not null default 0,
  draws int not null default 0,
  losses int not null default 0,
  updated_at timestamptz not null default now()
);
create index gaming_chess_ratings_best_idx on public.gaming_chess_ratings(best_rating desc);

-- Igual que gaming_chess_games: cero superficie REST/anónima, solo service_role.
alter table public.gaming_chess_ratings enable row level security;
revoke all on table public.gaming_chess_ratings from anon, authenticated;
grant all on table public.gaming_chess_ratings to service_role;

-- El trigger legacy solo rellena puntos que nadie seteó. Si el edge ya escribió
-- points_awarded explícito (chess), lo respeta tal cual.
create or replace function public.recalculate_gaming_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'UPDATE' and new.status = 'confirmed' and old.status is distinct from 'confirmed') then
    update public.gaming_match_participants
    set points_awarded = case
      when points_awarded = 0 then public.gaming_points_for_placement(placement)
      else points_awarded
    end
    where match_id = new.id;

    insert into public.gaming_scores (player_id, total_points, updated_at)
    select mp.player_id, sum(mp.points_awarded), now()
    from public.gaming_match_participants mp
    join public.gaming_matches m on m.id = mp.match_id
    where m.status = 'confirmed'
      and mp.player_id in (select player_id from public.gaming_match_participants where match_id = new.id)
    group by mp.player_id
    on conflict (player_id) do update set total_points = excluded.total_points, updated_at = excluded.updated_at;
  end if;
  return new;
end;
$$;