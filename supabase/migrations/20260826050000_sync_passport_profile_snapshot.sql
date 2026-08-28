-- Persiste en gaming_players el snapshot vinculado desde Stellar Passport
-- y los campos editables locales del perfil público de Tierly.

alter table public.gaming_players
  add column if not exists username text,
  add column if not exists bio text,
  add column if not exists twitter_handle text,
  add column if not exists telegram_handle text,
  add column if not exists discord_handle text,
  add column if not exists stellar_passport_username text,
  add column if not exists stellar_passport_avatar_url text,
  add column if not exists stellar_passport_bio text,
  add column if not exists stellar_passport_role_title text,
  add column if not exists stellar_passport_tier text,
  add column if not exists stellar_passport_project_count int,
  add column if not exists stellar_passport_commits_30d int,
  add column if not exists stellar_passport_active_days_30d int;

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
