-- Tierly V0: cierre de sesiones, agregacion diaria, purga y sugerencias.

create extension if not exists pg_cron;

create or replace function public.tierly_close_sessions_at_heartbeat(session_ids bigint[])
returns integer
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.play_sessions
    set ended_at = last_heartbeat_at, closed_reason = 'heartbeat'
    where id = any(session_ids) and ended_at is null
    returning 1
  )
  select count(*)::int from updated;
$$;

create or replace function public.tierly_close_orphan_sessions(target_guild text)
returns integer
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.play_sessions
    set ended_at = last_heartbeat_at, closed_reason = 'crash'
    where guild_id = target_guild and ended_at is null
    returning 1
  )
  select count(*)::int from updated;
$$;

create or replace function public.tierly_close_stale_sessions()
returns integer
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.play_sessions s
    set ended_at = s.last_heartbeat_at, closed_reason = 'timeout'
    from public.communities c
    where c.guild_id = s.guild_id
      and s.ended_at is null
      and s.last_heartbeat_at < now() - make_interval(hours => c.stale_session_hours)
    returning 1
  )
  select count(*)::int from updated;
$$;

create or replace function public.tierly_rollup_day(target_day date default (current_date - 1))
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
begin
  insert into public.daily_game_rollups
    (guild_id, game_id, day, unique_players, total_minutes, session_count)
  select
    s.guild_id,
    s.game_id,
    target_day,
    count(distinct s.discord_user_id),
    sum(least(s.minutes, c.session_cap_minutes)),
    count(*)
  from public.play_sessions s
  join public.communities c on c.guild_id = s.guild_id
  where s.ended_at is not null
    and s.started_at >= target_day
    and s.started_at < target_day + 1
  group by s.guild_id, s.game_id
  on conflict (guild_id, game_id, day) do update
    set unique_players = excluded.unique_players,
        total_minutes = excluded.total_minutes,
        session_count = excluded.session_count;

  get diagnostics inserted = row_count;

  delete from public.play_sessions s
  using public.communities c
  where c.guild_id = s.guild_id
    and s.ended_at is not null
    and s.started_at < now() - make_interval(days => c.retention_days);

  return inserted;
end;
$$;

create or replace function public.tierly_generate_suggestions()
returns integer
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select r.guild_id, r.game_id, sum(r.unique_players)::integer as players
    from public.daily_game_rollups r
    where r.day >= current_date - 7
    group by r.guild_id, r.game_id
  ), eligible as (
    select c.guild_id, c.game_id, c.players
    from candidates c
    join public.communities com on com.guild_id = c.guild_id
    where c.players >= com.suggestion_threshold
      and not exists (
        select 1
        from public.suggested_events se
        where se.guild_id = c.guild_id
          and se.game_id = c.game_id
          and se.status = 'pending'
      )
  ), inserted as (
    insert into public.suggested_events (guild_id, game_id, window_days, player_count)
    select guild_id, game_id, 7, players from eligible
    returning 1
  )
  select count(*)::int from inserted;
$$;

select cron.unschedule('tierly-rollup-diario')
where exists (select 1 from cron.job where jobname = 'tierly-rollup-diario');
select cron.unschedule('tierly-cerrar-sesiones-viejas')
where exists (select 1 from cron.job where jobname = 'tierly-cerrar-sesiones-viejas');
select cron.unschedule('tierly-sugerencias')
where exists (select 1 from cron.job where jobname = 'tierly-sugerencias');

select cron.schedule(
  'tierly-rollup-diario', '15 4 * * *',
  $$select public.tierly_rollup_day();$$
);
select cron.schedule(
  'tierly-cerrar-sesiones-viejas', '5 * * * *',
  $$select public.tierly_close_stale_sessions();$$
);
select cron.schedule(
  'tierly-sugerencias', '30 4 * * *',
  $$select public.tierly_generate_suggestions();$$
);

revoke all on function public.tierly_close_sessions_at_heartbeat(bigint[]) from public, anon, authenticated;
revoke all on function public.tierly_close_orphan_sessions(text) from public, anon, authenticated;
revoke all on function public.tierly_close_stale_sessions() from public, anon, authenticated;
revoke all on function public.tierly_rollup_day(date) from public, anon, authenticated;
revoke all on function public.tierly_generate_suggestions() from public, anon, authenticated;
grant execute on function public.tierly_close_sessions_at_heartbeat(bigint[]) to service_role;
grant execute on function public.tierly_close_orphan_sessions(text) to service_role;
grant execute on function public.tierly_close_stale_sessions() to service_role;
grant execute on function public.tierly_rollup_day(date) to service_role;
grant execute on function public.tierly_generate_suggestions() to service_role;
