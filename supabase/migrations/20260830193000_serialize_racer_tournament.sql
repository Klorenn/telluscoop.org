create or replace function public.finalize_gaming_racer_run(
  p_run_id uuid,
  p_player_id uuid,
  p_completed boolean,
  p_elapsed_ticks int,
  p_finish_position int,
  p_confirmed_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.gaming_racer_runs%rowtype;
  v_policy public.gaming_racer_reward_policy%rowtype;
  v_best public.gaming_racer_best_times%rowtype;
  v_tournament_id uuid;
  v_match_id uuid;
  v_personal_best boolean;
  v_points_awarded int;
  v_result jsonb;
begin
  select *
  into v_run
  from public.gaming_racer_runs
  where id = p_run_id
    and player_id = p_player_id
  for update;

  if v_run.id is null then
    return jsonb_build_object('status', 'ticket_invalid');
  end if;

  if v_run.status = 'validated' then
    return v_run.result;
  end if;

  if v_run.status <> 'submitted' then
    return jsonb_build_object('status', 'conflict');
  end if;

  if not p_completed or p_elapsed_ticks <= 0 or p_finish_position is null or p_finish_position < 1 then
    update public.gaming_racer_runs
    set status = 'rejected',
        rejection_reason = 'run_incomplete'
    where id = v_run.id;
    return jsonb_build_object(
      'status', 'rejected',
      'completed', false,
      'elapsed_ticks', 0,
      'finish_position', null,
      'points_awarded', 0,
      'personal_best', false,
      'rejection_code', 'run_incomplete'
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_player_id::text || ':' || v_run.track_id || ':' || v_run.simulation_version, 0));

  select *
  into v_policy
  from public.gaming_racer_reward_policy
  where track_id = v_run.track_id
    and simulation_version = v_run.simulation_version
  for update;

  if v_policy.id is null then
    return jsonb_build_object('status', 'policy_missing');
  end if;

  select *
  into v_best
  from public.gaming_racer_best_times
  where player_id = p_player_id
    and track_id = v_run.track_id
    and simulation_version = v_run.simulation_version
  for update;

  v_personal_best := v_best.id is null or p_elapsed_ticks < v_best.best_elapsed_ticks;
  v_points_awarded := v_policy.finish_points
    + case when p_finish_position = 1 then v_policy.bot_win_bonus_points else 0 end
    + case when v_personal_best then v_policy.personal_best_bonus_points else 0 end;

  perform pg_advisory_xact_lock(hashtextextended('gaming_tournament:Racer:' || public.gaming_season_start()::text, 0));
  v_tournament_id := public.ensure_gaming_season_tournament('Racer');

  insert into public.gaming_matches (tournament_id, status)
  values (v_tournament_id, 'pending')
  returning id into v_match_id;

  insert into public.gaming_match_participants (
    match_id,
    player_id,
    placement,
    points_awarded
  ) values (
    v_match_id,
    p_player_id,
    p_finish_position,
    v_points_awarded
  );

  if v_personal_best then
    if v_best.id is null then
      insert into public.gaming_racer_best_times (
        player_id,
        track_id,
        simulation_version,
        best_elapsed_ticks,
        run_id
      ) values (
        p_player_id,
        v_run.track_id,
        v_run.simulation_version,
        p_elapsed_ticks,
        v_run.id
      );
    else
      update public.gaming_racer_best_times
      set best_elapsed_ticks = p_elapsed_ticks,
          run_id = v_run.id
      where id = v_best.id
        and p_elapsed_ticks < v_best.best_elapsed_ticks;
    end if;
  end if;

  v_result := jsonb_build_object(
    'status', 'validated',
    'completed', true,
    'elapsed_ticks', p_elapsed_ticks,
    'finish_position', p_finish_position,
    'points_awarded', v_points_awarded,
    'personal_best', v_personal_best
  );

  update public.gaming_racer_runs
  set status = 'validated',
      validated_at = now(),
      result = v_result,
      match_id = v_match_id
  where id = v_run.id
    and match_id is null;

  update public.gaming_matches
  set status = 'confirmed',
      confirmed_by = p_confirmed_by,
      confirmed_at = now()
  where id = v_match_id
    and status = 'pending';

  return v_result;
end;
$$;

revoke all on function public.finalize_gaming_racer_run(uuid, uuid, boolean, int, int, uuid) from public, anon, authenticated;
grant execute on function public.finalize_gaming_racer_run(uuid, uuid, boolean, int, int, uuid) to service_role;
