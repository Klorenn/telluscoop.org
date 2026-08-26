-- Permite a un jugador vincular su perfil de builder de Stellar Passport
-- (demo.stellarpassport.xyz) a su fila de gaming_players. Stellar Passport
-- todavía no tiene API pública (confirmado: solo hay perfiles autoalojados),
-- así que esto es un link autoreportado por el propio jugador, guardado por
-- discord-verify (mismo canal service-role ya validado — no se abre RLS
-- nueva de escritura directa del cliente sobre gaming_players).

alter table public.gaming_players
  add column if not exists stellar_passport_url text;

create or replace view public.leaderboard_public_view as
select
  p.id as player_id,
  p.display_name,
  p.avatar_url,
  coalesce(s.total_points, 0) as total_points,
  p.discord_member,
  p.stellar_passport_url
from public.gaming_players p
left join public.gaming_scores s on s.player_id = p.id
order by coalesce(s.total_points, 0) desc;

grant select on public.leaderboard_public_view to anon, authenticated;
