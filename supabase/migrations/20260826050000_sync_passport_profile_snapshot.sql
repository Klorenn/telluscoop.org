alter table public.gaming_players add column if not exists username text unique;
alter table public.gaming_players add column if not exists bio text;
alter table public.gaming_players add column if not exists twitter_handle text;
alter table public.gaming_players add column if not exists telegram_handle text;
alter table public.gaming_players add column if not exists discord_handle text;
alter table public.gaming_players add column if not exists stellar_passport_username text;
alter table public.gaming_players add column if not exists stellar_passport_avatar_url text;
alter table public.gaming_players add column if not exists stellar_passport_bio text;
alter table public.gaming_players add column if not exists stellar_passport_role_title text;
alter table public.gaming_players add column if not exists stellar_passport_tier text;
alter table public.gaming_players add column if not exists stellar_passport_project_count int;
alter table public.gaming_players add column if not exists stellar_passport_commits_30d int;
alter table public.gaming_players add column if not exists stellar_passport_active_days_30d int;

create or replace view public.leaderboard_public_view as
select p.id as player_id, p.username, p.display_name, p.avatar_url, p.discord_member,
       coalesce(s.total_points, 0) as total_points
from public.gaming_players p
left join public.gaming_scores s on s.player_id = p.id
order by coalesce(s.total_points, 0) desc;
grant select on public.leaderboard_public_view to anon, authenticated;
