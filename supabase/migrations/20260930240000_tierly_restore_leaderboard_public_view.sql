-- Restaura la vista pública de leaderboard después del retiro de la capa de brackets.
--
-- `tierly_drop_bracket_layer` eliminó las vistas públicas de brackets, recompensas y
-- catálogo de torneos. `gaming_players` y `gaming_scores` sobreviven porque Chess y
-- Racer dependen de ellas, así que el ranking sigue teniendo datos válidos; lo que
-- falta es la proyección pública que el frontend y el bot leen.
--
-- Identidad: la vista no expone `discord_id` ni `auth_user_id`. El navegador recibe
-- únicamente el `discord_member` booleano que ya se publicaba, más los campos de perfil
-- que la tarjeta de jugador renderiza (banner, banner_fit, bio).
--
-- No se restaura `gaming_rewards_public_view` ni `gaming_events_catalog_public_view`:
-- sus tablas base (`gaming_rewards`, `gaming_tournament_registrations`) se eliminaron a
-- propósito y el ciclo de eventos usa `gaming_events` + `tierly_event_attendance`.

drop view if exists public.leaderboard_public_view;

create view public.leaderboard_public_view as
select p.id                        as player_id,
       p.username,
       p.display_name,
       p.avatar_url,
       p.discord_member,
       p.banner,
       p.banner_fit,
       p.bio,
       coalesce(s.total_points, 0) as total_points
from public.gaming_players p
left join public.gaming_scores s on s.player_id = p.id
where p.discord_member is true;

grant select on public.leaderboard_public_view to anon, authenticated;