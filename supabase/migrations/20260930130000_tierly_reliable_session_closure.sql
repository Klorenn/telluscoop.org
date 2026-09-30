-- Cierra sesiones usando el ultimo heartbeat observado y la configuracion de la comunidad.
create or replace function public.tierly_close_stale_sessions_for_guild(
  target_guild text,
  stale_before timestamptz default now()
)
returns integer
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.play_sessions s
    set ended_at = s.last_heartbeat_at, closed_reason = 'heartbeat'
    from public.communities c
    where c.guild_id = s.guild_id
      and s.guild_id = target_guild
      and s.ended_at is null
      and s.last_heartbeat_at < stale_before
      and s.last_heartbeat_at < now() - make_interval(hours => c.stale_session_hours)
    returning 1
  )
  select count(*)::int from updated;
$$;

revoke all on function public.tierly_close_stale_sessions_for_guild(text, timestamptz) from public, anon, authenticated;
grant execute on function public.tierly_close_stale_sessions_for_guild(text, timestamptz) to service_role;
