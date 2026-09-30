-- Identidad y estado de presencia para el panel administrativo de Tierly.
drop view if exists public.tierly_admin_game_players;

create view public.tierly_admin_game_players
  with (security_invoker = true)
as
  select distinct on (sessions.guild_id, sessions.game_id, sessions.discord_user_id)
    sessions.guild_id,
    sessions.game_id,
    members.display_name,
    members.avatar_url,
    exists (
      select 1
      from public.play_sessions active_sessions
      where active_sessions.guild_id = sessions.guild_id
        and active_sessions.game_id = sessions.game_id
        and active_sessions.discord_user_id = sessions.discord_user_id
        and active_sessions.ended_at is null
    ) as is_active,
    sessions.started_at
  from public.play_sessions sessions
  join public.observed_members members
    on members.guild_id = sessions.guild_id
   and members.discord_user_id = sessions.discord_user_id
  order by sessions.guild_id, sessions.game_id, sessions.discord_user_id,
    (sessions.ended_at is null) desc, sessions.started_at desc;

revoke all on public.tierly_admin_game_players from public;
grant select on public.tierly_admin_game_players to authenticated;
