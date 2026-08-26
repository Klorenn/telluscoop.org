alter table public.gaming_players
  add column if not exists stellar_passport_name text;

create or replace view public.leaderboard_public_view as
select
  p.id as player_id,
  p.display_name,
  p.avatar_url,
  coalesce(s.total_points, 0) as total_points,
  p.discord_member,
  p.stellar_passport_url,
  p.stellar_passport_name
from public.gaming_players p
left join public.gaming_scores s on s.player_id = p.id
order by coalesce(s.total_points, 0) desc;

grant select on public.leaderboard_public_view to anon, authenticated;
