-- Identidad segura para el panel administrativo de Tierly.
alter table public.observed_members
  add column if not exists display_name text,
  add column if not exists avatar_url text;

create index if not exists observed_members_guild_name
  on public.observed_members (guild_id, display_name);

drop view if exists public.tierly_admin_game_players;
create view public.tierly_admin_game_players
  with (security_invoker = true)
as
  select distinct
    sessions.guild_id,
    sessions.game_id,
    members.display_name,
    members.avatar_url
  from public.play_sessions sessions
  join public.observed_members members
    on members.guild_id = sessions.guild_id
   and members.discord_user_id = sessions.discord_user_id;

revoke all on public.tierly_admin_game_players from public;
grant select on public.tierly_admin_game_players to authenticated;
