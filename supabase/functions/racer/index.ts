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
type RpcPayload = Record<string, unknown>;

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

async function startRun(admin: DbClient, playerId: string) {
  const now = new Date();
  const opaqueTicket = randomToken();
  const ticketHash = await sha256Hex(opaqueTicket);
  const seed = randomSeed();
  const expiresAt = new Date(now.getTime() + TICKET_TTL_MS).toISOString();
  const { data, error } = await admin.rpc("issue_gaming_racer_run" as never, {
    p_player_id: playerId,
    p_track_id: TRACK_ID,
    p_simulation_version: SIMULATION_VERSION,
    p_seed: seed,
    p_ticket_hash: ticketHash,
    p_expires_at: expiresAt,
    p_input_limits: INPUT_LIMITS,
  } as never);
  if (error || !data) throw error ?? new Error("run_create_failed");

  const issued = data as RpcPayload;
  if (issued.status === "too_many_active_tickets") return { error: "too_many_active_tickets", status: 429 };
  if (issued.status === "policy_missing") return { error: "Política de carrera no configurada", status: 500 };
  if (issued.status !== "issued" || typeof issued.run_id !== "string") throw new Error("run_create_failed");

  publicLog({
    run_id: issued.run_id,
    player_id: playerId,
    simulation_version: SIMULATION_VERSION,
    track_id: TRACK_ID,
    outcome: "issued",
  });

  return {
    run_id: issued.run_id,
    opaque_ticket: opaqueTicket,
    track_id: TRACK_ID,
    simulation_version: SIMULATION_VERSION,
    seed,
    expires_at: expiresAt,
    input_limits: INPUT_LIMITS,
  };
}

function storedResult(result: RpcPayload) {
  return {
    status: "validated",
    completed: Boolean(result.completed),
    elapsed_ticks: Number(result.elapsed_ticks ?? 0),
    finish_position: result.finish_position ?? null,
    points_awarded: Number(result.points_awarded ?? 0),
    personal_best: Boolean(result.personal_best),
  };
}

function rejectedResult(result: RpcPayload) {
  return {
    status: "rejected",
    completed: false,
    elapsed_ticks: 0,
    finish_position: null,
    points_awarded: 0,
    personal_best: false,
    rejection_code: typeof result.rejection_code === "string" ? result.rejection_code : "replay_invalid",
  };
}

async function rejectRun(
  admin: DbClient,
  runId: string,
  playerId: string,
  code: string,
  startedAt: number,
) {
  const { data, error } = await admin.rpc("reject_gaming_racer_run" as never, {
    p_run_id: runId,
    p_player_id: playerId,
    p_rejection_reason: code,
  } as never);
  if (error) throw error;
  publicLog({
    run_id: runId,
    player_id: playerId,
    simulation_version: SIMULATION_VERSION,
    track_id: TRACK_ID,
    outcome: "rejected",
    rejection_code: code,
    simulation_ms: Date.now() - startedAt,
  });
  const rejected = (data as RpcPayload | null) ?? { rejection_code: code };
  if (rejected.status === "validated") return storedResult(rejected);
  return rejectedResult(rejected);
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
  const { data: claimData, error: claimError } = await admin.rpc("claim_gaming_racer_run" as never, {
    p_run_id: runId,
    p_player_id: playerId,
    p_ticket_hash: ticketHash,
    p_now: new Date().toISOString(),
  } as never);
  if (claimError) throw claimError;
  const claimed = (claimData as RpcPayload | null) ?? {};
  if (claimed.status === "ticket_invalid") return { error: "ticket_invalid", status: 404 };
  if (claimed.status === "validated") return storedResult(claimed);
  if (claimed.status === "rejected") return rejectedResult(claimed);
  if (claimed.status === "conflict") return { error: "submit_conflict", status: 409 };
  if (claimed.status !== "submitted") return { error: "ticket_invalid", status: 400 };
  if (claimed.track_id !== TRACK_ID || claimed.simulation_version !== SIMULATION_VERSION) {
    return await rejectRun(admin, runId, playerId, "ticket_invalid", startedAt);
  }

  let result;
  try {
    result = simulateRun(Number(claimed.seed), replay);
  } catch {
    return await rejectRun(admin, runId, playerId, "replay_invalid", startedAt);
  }
  if (!result.completed || result.elapsedTicks > MAX_TICKS || result.finishPosition === null) {
    return await rejectRun(admin, runId, playerId, "run_incomplete", startedAt);
  }

  const { data: finalData, error: finalError } = await admin.rpc("finalize_gaming_racer_run" as never, {
    p_run_id: runId,
    p_player_id: playerId,
    p_completed: result.completed,
    p_elapsed_ticks: result.elapsedTicks,
    p_finish_position: result.finishPosition,
    p_confirmed_by: userId,
  } as never);
  if (finalError || !finalData) throw finalError ?? new Error("racer_finalize_failed");
  const credited = storedResult(finalData as RpcPayload);

  publicLog({
    run_id: runId,
    player_id: playerId,
    simulation_version: claimed.simulation_version,
    track_id: claimed.track_id,
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
