-- Atomic RPCs for Tierly Racer ticket issuance, submit ownership, and credit.
-- The Edge Function validates identity and re-simulates replays; these
-- SECURITY DEFINER functions own the private state transitions and score path.

create or replace function public.issue_gaming_racer_run(
  p_player_id uuid,
  p_track_id text,
  p_simulation_version text,
  p_seed bigint,
  p_ticket_hash text,
  p_expires_at timestamptz,
  p_input_limits jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_policy public.gaming_racer_reward_policy%rowtype;
  v_active_count int;
  v_run_id uuid;
  v_now timestamptz := now();
begin
  perform pg_advisory_xact_lock(hashtextextended(p_player_id::text, 0));

  select *
  into v_policy
  from public.gaming_racer_reward_policy
  where track_id = p_track_id
    and simulation_version = p_simulation_version
  for update;

  if v_policy.id is null then
    return jsonb_build_object('status', 'policy_missing');
  end if;

  update public.gaming_racer_runs
  set status = 'expired',
      expired_at = v_now
  where player_id = p_player_id
    and status = 'issued'
    and expires_at <= v_now;

  select count(*) into v_active_count
  from public.gaming_racer_runs
  where player_id = p_player_id
    and status = 'issued'
    and expires_at > v_now;

  if v_active_count >= v_policy.max_active_tickets then
    return jsonb_build_object('status', 'too_many_active_tickets');
  end if;

  insert into public.gaming_racer_runs (
    player_id,
    track_id,
    simulation_version,
    seed,
    ticket_hash,
    status,
    expires_at,
    input_limits
  ) values (
    p_player_id,
    p_track_id,
    p_simulation_version,
    p_seed,
    p_ticket_hash,
    'issued',
    p_expires_at,
    p_input_limits
  )
  returning id into v_run_id;

  return jsonb_build_object(
    'status', 'issued',
    'run_id', v_run_id,
    'seed', p_seed,
    'expires_at', p_expires_at,
    'input_limits', p_input_limits
  );
end;
$$;

create or replace function public.claim_gaming_racer_run(
  p_run_id uuid,
  p_player_id uuid,
  p_ticket_hash text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.gaming_racer_runs%rowtype;
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

  if v_run.ticket_hash <> p_ticket_hash then
    update public.gaming_racer_runs
    set status = 'rejected',
        rejection_reason = 'ticket_reused'
    where id = v_run.id
      and status in ('issued', 'submitted');
    return jsonb_build_object('status', 'rejected', 'rejection_code', 'ticket_reused');
  end if;

  if v_run.status <> 'issued' then
    return jsonb_build_object('status', 'conflict', 'rejection_code', 'ticket_reused');
  end if;

  if v_run.expires_at <= p_now then
    update public.gaming_racer_runs
    set status = 'expired',
        expired_at = p_now,
        rejection_reason = 'ticket_expired'
    where id = v_run.id;
    return jsonb_build_object('status', 'rejected', 'rejection_code', 'ticket_expired');
  end if;

  update public.gaming_racer_runs
  set status = 'submitted',
      submitted_at = p_now
  where id = v_run.id
    and status = 'issued';

  return jsonb_build_object(
    'status', 'submitted',
    'run_id', v_run.id,
    'player_id', v_run.player_id,
    'track_id', v_run.track_id,
    'simulation_version', v_run.simulation_version,
    'seed', v_run.seed
  );
end;
$$;

create or replace function public.reject_gaming_racer_run(
  p_run_id uuid,
  p_player_id uuid,
  p_rejection_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.gaming_racer_runs%rowtype;
  v_status text := case when p_rejection_reason = 'ticket_expired' then 'expired' else 'rejected' end;
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

  if v_run.status in ('issued', 'submitted') then
    update public.gaming_racer_runs
    set status = v_status,
        rejection_reason = p_rejection_reason,
        expired_at = case when v_status = 'expired' then now() else expired_at end
    where id = v_run.id;
  end if;

  return jsonb_build_object(
    'status', 'rejected',
    'completed', false,
    'elapsed_ticks', 0,
    'finish_position', null,
    'points_awarded', 0,
    'personal_best', false,
    'rejection_code', p_rejection_reason
  );
end;
$$;

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

revoke all on function public.issue_gaming_racer_run(uuid, text, text, bigint, text, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.claim_gaming_racer_run(uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.reject_gaming_racer_run(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.finalize_gaming_racer_run(uuid, uuid, boolean, int, int, uuid) from public, anon, authenticated;

grant execute on function public.issue_gaming_racer_run(uuid, text, text, bigint, text, timestamptz, jsonb) to service_role;
grant execute on function public.claim_gaming_racer_run(uuid, uuid, text, timestamptz) to service_role;
grant execute on function public.reject_gaming_racer_run(uuid, uuid, text) to service_role;
grant execute on function public.finalize_gaming_racer_run(uuid, uuid, boolean, int, int, uuid) to service_role;
