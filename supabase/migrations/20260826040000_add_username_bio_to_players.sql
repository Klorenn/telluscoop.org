-- Adds a public username slug + short bio to gaming_players, so a player can
-- have a real, shareable profile URL (/tierly/u/:username) instead of only
-- being addressable by matching Discord display_name at runtime.

alter table public.gaming_players
  add column if not exists username text,
  add column if not exists bio text;

create unique index if not exists gaming_players_username_key
  on public.gaming_players (username)
  where username is not null;

drop view if exists public.leaderboard_public_view;

create view public.leaderboard_public_view as
select
  p.id as player_id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.bio,
  coalesce(s.total_points, 0) as total_points,
  p.discord_member,
  p.stellar_passport_url,
  p.stellar_passport_name
from public.gaming_players p
left join public.gaming_scores s on s.player_id = p.id
order by coalesce(s.total_points, 0) desc;

grant select on public.leaderboard_public_view to anon, authenticated;
