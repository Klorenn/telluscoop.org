-- Retirada de la capa de brackets, recompensas y catálogo.
--
-- Reconstrucción del archivo de migración. Esta migración se aplicó en la base
-- de producción el 2026-09-29 pero su archivo nunca llegó al repositorio, por
-- lo que un `supabase db reset` desde este repo no reproducia el esquema real.
-- El contenido está reconstruido a partir de los objetos que el frontend y el
-- bot consultaban y que hoy no existen, verificado contra la base viva.
--
-- Todas las sentencias son `if exists`: es idempotente y no toca nada en una
-- base donde la capa ya no está.
--
-- Lo que NO se droppea aquí, y por qué:
--   - public.gaming_players y su columna last_notified_rank_min: la tabla se
--     conserva; solo se llevó la tabla de seguimiento de anuncios.
--   - public.gaming_scores, gaming_events, gaming_chess_*, gaming_racer_*,
--     gaming_matches y gaming_tournaments: siguen en uso por V0.
--
-- Las dos restauraciones posteriores son explícitas:
--   20260930240000 restaura leaderboard_public_view (el ranking es una función
--     viva, no bracket).
--   20260930260000 restaura gaming_bot_notifications (registro idempotente de
--     anuncios del bot).

-- Vistas públicas de la capa retirada.
drop view if exists public.event_bracket_public_view;
drop view if exists public.gaming_rewards_public_view;
drop view if exists public.gaming_events_catalog_public_view;
drop view if exists public.leaderboard_public_view;

-- RPC de inscripción a torneo. Se elimina antes que las tablas que consultaba.
drop function if exists public.tierly_register_for_tournament(uuid);

-- Registro idempotente de anuncios del bot (eventos nuevos y subidas de rango).
drop table if exists public.gaming_bot_notifications;
