-- supabase/migrations/20260829120000_add_chess_module.sql
-- Chess module — Tierly. Partidas contra el bot (Stockfish) o PvP, todas las
-- semanas dentro del torneo "Chess" de la temporada vigente. La puntuación
-- entra SIEMPRE por el pipeline existente: gaming_matches -> 'confirmed'
-- -> trigger recalculate_gaming_score(), igual que cualquier otro evento.
-- Anti-cheat: nada de esto se sirve ni se escribe por REST; la tabla solo la
-- toca el edge function via service role, y el resultado lo decide chess.js
-- del lado del servidor.

create table public.gaming_chess_games (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.gaming_tournaments(id) on delete cascade,
  white_player_id uuid references public.gaming_players(id) on delete set null,
  black_player_id uuid references public.gaming_players(id) on delete set null,
  mode text not null check (mode in ('bot', 'pvp')),
  bot_difficulty text check (
    (mode = 'bot' and bot_difficulty in ('easy', 'medium', 'hard'))
    or (mode = 'pvp' and bot_difficulty is null)
  ),
  status text not null default 'pending' check (status in ('pending', 'active', 'finished')),
  winner text check (winner in ('white', 'black', 'draw')),
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gaming_chess_games_white_idx on public.gaming_chess_games(white_player_id);
create index gaming_chess_games_black_idx on public.gaming_chess_games(black_player_id);
create index gaming_chess_games_status_idx on public.gaming_chess_games(status);
create trigger gaming_chess_games_touch before update on public.gaming_chess_games
for each row execute function public.touch_updated_at();

-- Cero superficie REST / anónima: ni anon ni authenticated agarran nada acá.
alter table public.gaming_chess_games enable row level security;
revoke all on table public.gaming_chess_games from anon, authenticated;

-- Obtiene (o crea) el torneo "Chess" del evento vigente de ESTE juego. El
-- evento se ancla al inicio de la temporada actual (gaming_season_start)
-- para que las partidas sumen al leaderboard — el view público filtra
-- e.event_date >= gaming_season_start(). Security definer + search path
-- vacío, igual que el resto del repo.
create or replace function public.ensure_gaming_season_tournament(p_game text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_event_date date := public.gaming_season_start();
  v_event_id uuid;
  v_tournament_id uuid;
begin
  -- Buscá el evento anclado a la temporada vigente para ESTE juego.
  select id, organization_id into v_event_id, v_org_id
  from public.gaming_events
  where name = p_game
    and event_date = v_event_date
  order by created_at desc
  limit 1;

  -- No existe todavía: resolvé la organización (del evento existente más
  -- reciente, o de la primera organización) y anclá el evento a la temporada.
  if v_event_id is null then
    select organization_id into v_org_id
    from public.gaming_events
    where organization_id is not null
    order by created_at desc
    limit 1;

    if v_org_id is null then
      select id into v_org_id
      from public.organizations
      order by created_at
      limit 1;
    end if;

    if v_org_id is null then
      raise exception 'No hay organización configurada para el torneo de ajedrez';
    end if;

    insert into public.gaming_events (organization_id, name, event_date)
    values (v_org_id, p_game, v_event_date)
    returning id into v_event_id;
  end if;

  select id into v_tournament_id
  from public.gaming_tournaments
  where event_id = v_event_id
    and game = p_game
    and format = 'elimination'
  order by created_at desc
  limit 1;

  if v_tournament_id is null then
    insert into public.gaming_tournaments (event_id, game, format, status)
    values (v_event_id, p_game, 'elimination', 'completed')
    returning id into v_tournament_id;
  end if;

  return v_tournament_id;
end;
$$;