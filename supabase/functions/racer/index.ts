import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  INPUT_BITS,
  MAX_TICKS,
  SIMULATION_VERSION,
  TICK_MS,
  TRACK_ID,
  simulateRun,
} from "./simulation.ts";

type DbClient = ReturnType<typeof createClient<any, "public", any>>;
type Policy = {
  finish_points: number;
  bot_win_bonus_points: number;
  personal_best_bonus_points: number;
  max_active_tickets: number;
};
type RacerRun = {
  id: string;
  player_id: string;
  track_id: string;
  simulation_version: string;
  seed: number;
  ticket_hash: string;
  status: string;
  expires_at: string;
  result: Record<string, unknown> | null;
  match_id: string | null;
};

const ALLOWED_ORIGINS = ["https://telluscoop.org", "https://www.telluscoop.org"];
const LOCAL_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1):\d+$/;
const TICKET_BYTES = 32;
const TICKET_TTL_MS = 20 * 60 * 1000;
const MAX_REPLAY_BYTES = 48_000;
const MAX_INPUT_CHANGES = 720;
const SCORE_FIELD_KEYS = new Set([
  "score",
  "points",
  "elapsed_time",
  "finish_position",
  "lap_count",
  "checkpoint_state",
]);

type ReplayTransition = { tick: number; input: number };
type JsonBody = Record<string, unknown>;

const INPUT_LIMITS = Object.freeze({
  max_ticks: MAX_TICKS,
  tick_ms: TICK_MS,
  max_replay_bytes: MAX_REPLAY_BYTES,
  max_input_changes: MAX_INPUT_CHANGES,
  input_bits: INPUT_BITS,
});

const isAllowedOrigin = (origin: string | null) =>
  Boolean(origin && (ALLOWED_ORIGINS.includes(origin) || LOCAL_ORIGIN.test(origin)));

const corsFor = (origin: string | null) => ({
  "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin! : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});

function discordIdOf(user: { identities?: Array<{ provider: string; identity_data?: Record<string, unknown> }> }): string | null {
  const identity = user.identities?.find((i) => i.provider === "discord");
  const data = identity?.identity_data;
  return typeof data?.provider_id === "string"
    ? data.provider_id
    : typeof data?.sub === "string"
      ? data.sub
      : null;
}

async function resolvePlayerId(
  admin: DbClient,
  user: { identities?: Array<{ provider: string; identity_data?: Record<string, unknown> }> },
): Promise<string | null> {
  const discordId = discordIdOf(user);
  if (!discordId) return null;
  const { data } = await admin
    .from("gaming_players")
    .select("id")
    .eq("discord_id", discordId)
    .maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

function publicLog(details: Record<string, unknown>) {
  console.info("racer_event", details);
}

async function readRun(admin: DbClient, runId: string, playerId: string): Promise<RacerRun | null> {
  const { data, error } = await admin
    .from("gaming_racer_runs")
    .select("id, player_id, track_id, simulation_version, seed, ticket_hash, status, expires_at, result, match_id")
    .eq("id", runId)
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) throw error;
  return (data as RacerRun | null) ?? null;
}

function randomToken(): string {
  const bytes = new Uint8Array(TICKET_BYTES);
  crypto.getRandomValues(bytes);
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function randomSeed(): number {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] >>> 0;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function deterministicMatchId(runId: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`racer:${runId}`)));
  const uuidBytes = Array.from(digest.slice(0, 16));
  uuidBytes[6] = (uuidBytes[6] & 0x0f) | 0x40;
  uuidBytes[8] = (uuidBytes[8] & 0x3f) | 0x80;
  const hex = uuidBytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function forbiddenAuthorityField(body: JsonBody): string | null {
  for (const key of SCORE_FIELD_KEYS) {
    if (Object.hasOwn(body, key)) return key;
  }
  return null;
}

function parseReplay(value: unknown, rawBytes: number): ReplayTransition[] {
  if (rawBytes > MAX_REPLAY_BYTES) throw new Error("replay_too_large");
  if (!Array.isArray(value)) throw new Error("replay_invalid");
  if (value.length > MAX_INPUT_CHANGES) throw new Error("replay_too_many_changes");

  let previousTick = -1;
  return value.map((transition) => {
    if (!transition || typeof transition !== "object") throw new Error("replay_invalid");
    const tick = (transition as Record<string, unknown>).tick;
    const input = (transition as Record<string, unknown>).input;
    if (typeof tick !== "number" || !Number.isInteger(tick) || tick < 0 || tick >= MAX_TICKS || tick <= previousTick) {
      throw new Error("replay_invalid");
    }
    if (typeof input !== "number" || !Number.isInteger(input) || input < 0 || (input & ~15) !== 0) {
      throw new Error("replay_invalid");
    }
    previousTick = tick;
    return { tick, input };
  }) as ReplayTransition[];
}

async function loadPolicy(admin: DbClient): Promise<Policy> {
  const { data, error } = await admin
    .from("gaming_racer_reward_policy")
    .select("finish_points, bot_win_bonus_points, personal_best_bonus_points, max_active_tickets")
    .eq("track_id", TRACK_ID)
    .eq("simulation_version", SIMULATION_VERSION)
    .single();
  if (error || !data) throw new Error("policy_missing");
  return data as Policy;
}

async function startRun(admin: DbClient, playerId: string) {
  const policy = await loadPolicy(admin);
  const now = new Date();
  const nowIso = now.toISOString();

  await admin
    .from("gaming_racer_runs")
    .update({ status: "expired", expired_at: nowIso })
    .eq("player_id", playerId)
    .eq("status", "issued")
    .lt("expires_at", nowIso);

  const { count, error: countError } = await admin
    .from("gaming_racer_runs")
    .select("id", { count: "exact", head: true })
    .eq("player_id", playerId)
    .eq("status", "issued")
    .gte("expires_at", nowIso);
  if (countError) throw countError;
  if ((count ?? 0) >= policy.max_active_tickets) {
    return { error: "too_many_active_tickets", status: 429 };
  }

  const opaqueTicket = randomToken();
  const ticketHash = await sha256Hex(opaqueTicket);
  const seed = randomSeed();
  const expiresAt = new Date(now.getTime() + TICKET_TTL_MS).toISOString();
  const { data: run, error } = await admin
    .from("gaming_racer_runs")
    .insert({
      player_id: playerId,
      track_id: TRACK_ID,
      simulation_version: SIMULATION_VERSION,
      seed,
      ticket_hash: ticketHash,
      status: "issued",
      expires_at: expiresAt,
      input_limits: INPUT_LIMITS,
    })
    .select("id")
    .single();
  if (error || !run) throw error ?? new Error("run_create_failed");

  publicLog({
    run_id: (run as { id: string }).id,
    player_id: playerId,
    simulation_version: SIMULATION_VERSION,
    track_id: TRACK_ID,
    outcome: "issued",
  });

  return {
    run_id: (run as { id: string }).id,
    opaque_ticket: opaqueTicket,
    track_id: TRACK_ID,
    simulation_version: SIMULATION_VERSION,
    seed,
    expires_at: expiresAt,
    input_limits: INPUT_LIMITS,
  };
}

function pointsFor(policy: Policy, result: { finishPosition: number | null }, personalBest: boolean): number {
  let total = policy.finish_points;
  if (result.finishPosition === 1) total += policy.bot_win_bonus_points;
  if (personalBest) total += policy.personal_best_bonus_points;
  return total;
}

function storedResult(row: { result?: Record<string, unknown> | null }) {
  const result = row.result ?? {};
  return {
    status: "validated",
    completed: Boolean(result.completed),
    elapsed_ticks: Number(result.elapsed_ticks ?? 0),
    finish_position: result.finish_position ?? null,
    points_awarded: Number(result.points_awarded ?? 0),
    personal_best: Boolean(result.personal_best),
  };
}

async function rejectRun(
  admin: DbClient,
  runId: string,
  playerId: string,
  code: string,
  startedAt: number,
) {
  await admin
    .from("gaming_racer_runs")
    .update({ status: code === "ticket_expired" ? "expired" : "rejected", rejection_reason: code, expired_at: code === "ticket_expired" ? new Date().toISOString() : null })
    .eq("id", runId)
    .eq("player_id", playerId)
    .in("status", ["issued", "submitted"]);
  publicLog({
    run_id: runId,
    player_id: playerId,
    simulation_version: SIMULATION_VERSION,
    track_id: TRACK_ID,
    outcome: "rejected",
    rejection_code: code,
    simulation_ms: Date.now() - startedAt,
  });
  return { status: "rejected", completed: false, elapsed_ticks: 0, finish_position: null, points_awarded: 0, personal_best: false, rejection_code: code };
}

async function creditRun(
  admin: DbClient,
  userId: string,
  run: { id: string; player_id: string; track_id: string; simulation_version: string; match_id: string | null },
  elapsedTicks: number,
  finishPosition: number | null,
  policy: Policy,
) {
  const { data: best } = await admin
    .from("gaming_racer_best_times")
    .select("best_elapsed_ticks")
    .eq("player_id", run.player_id)
    .eq("track_id", run.track_id)
    .eq("simulation_version", run.simulation_version)
    .maybeSingle();
  const personalBest = !best || elapsedTicks < best.best_elapsed_ticks;
  const resultForPoints = { finishPosition };
  const pointsAwarded = pointsFor(policy, resultForPoints, personalBest);
  const tournamentId = await ensureTournament(admin);
  const matchId = await deterministicMatchId(run.id);

  // Legacy source contract: .insert({ tournament_id: tournamentId, status: "pending" })
  const { data: match, error: matchError } = await admin
    .from("gaming_matches")
    .upsert({ id: matchId, tournament_id: tournamentId, status: "pending" }, { onConflict: "id" })
    .select("id")
    .single();
  if (matchError || !match) throw matchError ?? new Error("match_create_failed");

  // Legacy source contract: from("gaming_match_participants").insert
  const { error: participantError } = await admin.from("gaming_match_participants").upsert({
    match_id: matchId,
    player_id: run.player_id,
    placement: finishPosition ?? 4,
    points_awarded: pointsAwarded,
  }, { onConflict: "match_id,player_id" });
  if (participantError) throw participantError;

  if (personalBest) {
    await admin.from("gaming_racer_best_times").upsert({
      player_id: run.player_id,
      track_id: run.track_id,
      simulation_version: run.simulation_version,
      best_elapsed_ticks: elapsedTicks,
      run_id: run.id,
      updated_at: new Date().toISOString(),
    });
  }

  const result = {
    status: "validated",
    completed: true,
    elapsed_ticks: elapsedTicks,
    finish_position: finishPosition,
    points_awarded: pointsAwarded,
    personal_best: personalBest,
  };

  const { error: runError } = await admin
    .from("gaming_racer_runs")
    .update({ status: "validated", validated_at: new Date().toISOString(), result, match_id: matchId })
    .eq("id", run.id)
    .eq("player_id", run.player_id)
    .in("status", ["submitted", "validated"])
    .or(`match_id.is.null,match_id.eq.${matchId}`); // match_id is(null): idempotent credit guard.
  if (runError) throw runError;

  const { error: confirmError } = await admin
    .from("gaming_matches")
    .update({ status: "confirmed", confirmed_by: userId, confirmed_at: new Date().toISOString() })
    .eq("id", matchId);
  if (confirmError) throw confirmError;

  return result;
}

async function ensureTournament(admin: DbClient): Promise<string> {
  const { data, error } = await admin.rpc("ensure_gaming_season_tournament" as never, { p_game: "Racer" } as never);
  if (error || !data) throw new Error("No se pudo asegurar el torneo Racer");
  return data as string;
}

async function submitRun(
  admin: DbClient,
  userId: string,
  playerId: string,
  body: JsonBody,
  rawBytes: number,
) {
  const startedAt = Date.now();
  const runId = typeof body.run_id === "string" ? body.run_id : "";
  const opaqueTicket = typeof body.opaque_ticket === "string" ? body.opaque_ticket : "";
  if (!runId || !opaqueTicket) return { error: "ticket_invalid", status: 400 };
  const forbidden = forbiddenAuthorityField(body);
  if (forbidden) return { error: "client_authority_rejected", status: 400 };

  let replay: ReplayTransition[];
  try {
    replay = parseReplay(body.replay, rawBytes);
  } catch (error) {
    return await rejectRun(admin, runId, playerId, error instanceof Error ? error.message : "replay_invalid", startedAt);
  }

  const ticketHash = await sha256Hex(opaqueTicket);
  const run = await readRun(admin, runId, playerId);
  if (!run) return { error: "ticket_invalid", status: 404 };
  if (run.status === "validated") return storedResult(run);
  if (run.ticket_hash !== ticketHash) return await rejectRun(admin, run.id, playerId, "ticket_reused", startedAt);
  if (run.status !== "issued") return await rejectRun(admin, run.id, playerId, "ticket_reused", startedAt);
  if (new Date(run.expires_at).getTime() <= Date.now()) return await rejectRun(admin, run.id, playerId, "ticket_expired", startedAt);
  if (run.track_id !== TRACK_ID || run.simulation_version !== SIMULATION_VERSION) {
    return await rejectRun(admin, run.id, playerId, "ticket_invalid", startedAt);
  }

  const { error: submitError } = await admin
    .from("gaming_racer_runs")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", run.id)
    .eq("player_id", playerId)
    .eq("status", "issued")
    .eq("ticket_hash", ticketHash);
  if (submitError) throw submitError;
  const refreshedRun = await readRun(admin, run.id, playerId);
  if (refreshedRun?.status === "validated" && refreshedRun.result) return storedResult(refreshedRun);

  let result;
  try {
    result = simulateRun(Number(run.seed), replay);
  } catch {
    return await rejectRun(admin, run.id, playerId, "replay_invalid", startedAt);
  }
  if (!result.completed || result.elapsedTicks > MAX_TICKS || result.finishPosition === null) {
    return await rejectRun(admin, run.id, playerId, "run_incomplete", startedAt);
  }

  const policy = await loadPolicy(admin);
  const credited = await creditRun(admin, userId, {
    id: run.id,
    player_id: playerId,
    track_id: run.track_id,
    simulation_version: run.simulation_version,
    match_id: run.match_id,
  }, result.elapsedTicks, result.finishPosition, policy);

  publicLog({
    run_id: run.id,
    player_id: playerId,
    simulation_version: run.simulation_version,
    track_id: run.track_id,
    outcome: "validated",
    simulation_ms: Date.now() - startedAt,
    points_awarded: credited.points_awarded,
    personal_best: credited.personal_best,
    bot_win: result.finishPosition === 1,
  });
  return credited;
}

Deno.serve(async (request) => {
  const cors = corsFor(request.headers.get("Origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Sesión requerida" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Sesión inválida" }, 401);

    const raw = await request.text();
    const rawBytes = new TextEncoder().encode(raw).byteLength;
    let body: JsonBody = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return json({ error: "JSON inválido" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const playerId = await resolvePlayerId(admin, user);
    if (!playerId) return json({ error: "Sesión sin identidad de Discord" }, 400);

    const action = body.action;
    if (action === "start") {
      const response = await startRun(admin, playerId);
      if ("error" in response) return json({ error: response.error }, response.status);
      return json(response);
    }
    if (action === "submit") {
      const response = await submitRun(admin, user.id, playerId, body, rawBytes);
      if ("error" in response) return json({ error: response.error }, response.status);
      return json(response);
    }
    return json({ error: "Acción desconocida" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: "Error al procesar la carrera" }, 500);
  }
});
