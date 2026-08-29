import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { Chess } from "npm:chess.js@1.4.0";

const ALLOWED_ORIGINS = ["https://telluscoop.org", "https://www.telluscoop.org"];
const LOCAL_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1):\d+$/;

const isAllowedOrigin = (origin: string | null) =>
  Boolean(origin && (ALLOWED_ORIGINS.includes(origin) || LOCAL_ORIGIN.test(origin)));

const corsFor = (origin: string | null) => ({
  "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin! : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});

// Un jugador humano siempre es blancas contra el bot. Puntos: victoria según
// dificultad (hard=2do, medium=3ro, easy=1ro… no, es el revés del podio:
// hard=1ro), empate y derrota. Las claves son exactas para el test que las
// valida contra el spec.
const BOT_PLACEMENTS = { win_hard: 1, win_medium: 2, win_easy: 3, draw: 3, loss: 4 };

// Puntos explícitos por partida (el browser nunca decide el resultado): bot
// easy=10, medium=20, hard=25; empate=3 (bot) o 5 (PvP); derrota=1. En PvP el
// ganador suma 25 + bono de racha (+2 por victoria consecutiva, máx +10).
type Difficulty = "easy" | "medium" | "hard";

function difficultyOf(value: string | null | undefined): Difficulty {
  return value === "easy" || value === "hard" ? value : "medium";
}

const BOT_WIN_POINTS: Record<Difficulty, number> = { easy: 10, medium: 20, hard: 25 };
const PVP_WIN_POINTS = 25;
const PVP_DRAW_POINTS = 5;
const BOT_DRAW_POINTS = 3;
const LOSS_POINTS = 1;
const STREAK_BONUS_STEP = 2;
const STREAK_BONUS_MAX = 10;

// Rating Elo de ajedrez. Piso inicial 1200, K=32. Los bots tienen rating fijo
// por dificultad para que ganarle al difícil suba más Elo que al fácil.
const ELO_START = 1200;
const ELO_K = 32;
const ELO_FLOOR = 100;
const BOT_RATINGS: Record<Difficulty, number> = { easy: 800, medium: 1000, hard: 1200 };

// Resultado de una partida jugada con blancas/negras: ganar=1, empate=0.5, perder=0.
function gameScore(winner: "white" | "black" | "draw", color: "white" | "black"): number {
  if (winner === "draw") return 0.5;
  return winner === color ? 1 : 0;
}

// Probabilidad esperada de ganar (fórmula de Elo estándar).
function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + Math.pow(10, (opponent - rating) / 400));
}

function eloDelta(rating: number, opponent: number, score: number): number {
  return Math.round(ELO_K * (score - expectedScore(rating, opponent)));
}

// Racha actual: victorias PvP consecutivas del jugador antes de ESTA partida.
async function pvpStreak(
  admin: ReturnType<typeof createClient>,
  playerId: string,
): Promise<number> {
  const { data, error } = await admin
    .from("gaming_chess_games")
    .select("winner, white_player_id")
    .eq("mode", "pvp")
    .eq("status", "finished")
    .or(`white_player_id.eq.${playerId},black_player_id.eq.${playerId}`)
    .order("finished_at", { ascending: false })
    .limit(30);
  if (error || !data) return 0;
  let streak = 0;
  for (const game of data) {
    if (game.winner === "draw") break;
    const wonAsWhite = game.white_player_id === playerId && game.winner === "white";
    const wonAsBlack = game.white_player_id !== playerId && game.winner === "black";
    if (!wonAsWhite && !wonAsBlack) break;
    streak += 1;
  }
  return streak;
}

// Aplica un movimiento legal de from -> to. Si el destino solo admite
  const GAME_SELECT = [
  "id",
  "tournament_id",
  "match_id",
  "white_player_id",
  "black_player_id",
  "mode",
  "bot_difficulty",
  "status",
  "winner",
  "fen",
  "pgn",
  "started_at",
  "finished_at",
  "created_at",
  "updated_at",
].join(", ");

function discordIdOf(user: { identities?: Array<{ provider: string; identity_data?: Record<string, unknown> }> }): string | null {
  const identity = user.identities?.find((i) => i.provider === "discord");
  const data = identity?.identity_data;
  const id = typeof data?.provider_id === "string"
    ? data.provider_id
    : typeof data?.sub === "string"
      ? data.sub
      : null;
  return id;
}

async function resolvePlayerId(
  admin: ReturnType<typeof createClient>,
  user: { identities?: Array<{ provider: string; identity_data?: Record<string, unknown> }> },
): Promise<string | null> {
  const discordId = discordIdOf(user);
  if (!discordId) return null;
  const { data } = await admin
    .from("gaming_players")
    .select("id")
    .eq("discord_id", discordId)
    .maybeSingle();
  return data?.id ?? null;
}

function loadChess(row: { fen: string }): Chess {
  const chess = new Chess();
  if (row.fen) chess.load(row.fen);
  return chess;
}

// Aplica un movimiento legal de from -> to. Si el destino solo admite
// promociones y no vino promotion, auto-corona a dama ('q'). Devuelve false
// cuando el movimiento es ilegal para la posición real del servidor.
function applyMove(chess: Chess, from: string, to: string, promotion?: string): boolean {
  const candidates = chess.moves({ square: from, verbose: true }).filter((m) => m.to === to);
  if (candidates.length === 0) return false;
  const chosen = candidates.find((m) => m.promotion === promotion)
    ?? candidates.find((m) => !m.promotion)
    ?? candidates.find((m) => m.promotion === "q")
    ?? candidates[0];
  try {
    return Boolean(chess.move({ from, to, ...(chosen.promotion ? { promotion: chosen.promotion } : {}) }));
  } catch {
    return false;
  }
}

function gameResult(chess: Chess): null | { winner: "white" | "black" | "draw" } {
  if (!chess.isGameOver()) return null;
  if (chess.isCheckmate()) {
    // chess.turn() es el bando al que le toca mover: el que quedó en mate.
    return { winner: chess.turn() === "w" ? "black" : "white" };
  }
  return { winner: "draw" };
}

async function ensureTournament(admin: ReturnType<typeof createClient>): Promise<string> {
  const { data, error } = await admin.rpc("ensure_gaming_season_tournament", { p_game: "Chess" });
  if (error || !data) throw new Error("No se pudo asegurar el torneo de ajedrez");
  return data as string;
}

// finalizeGame: única vía de puntaje. Inserta 'pending' y recién después hace
// update a 'confirmed' para que dispare recalculate_gaming_score() — el
// browser nunca decide el resultado, lo decide chess.js acá en el server.
// Calcula puntos explícitos (por dificultad / PvP / racha) y el Elo de cada
// jugador, guarda todo y devuelve el resumen para que el cliente lo muestre.
async function finalizeGame(
  admin: ReturnType<typeof createClient>,
  userId: string,
  game: { id: string; mode: string; bot_difficulty: string | null; white_player_id: string; black_player_id: string | null; fen: string; pgn: string | null },
  chess: Chess,
  result: { winner: "white" | "black" | "draw" },
): Promise<Record<string, { points: number; rating_before: number; rating_after: number }>> {
  const tournamentId = await ensureTournament(admin);

  const { data: match, error: matchError } = await admin
    .from("gaming_matches")
    .insert({ tournament_id: tournamentId, status: "pending" })
    .select("id")
    .single();
  if (matchError || !match) throw new Error("No se pudo crear la partida");

  async function readRating(playerId: string): Promise<number> {
    const { data } = await admin
      .from("gaming_chess_ratings")
      .select("rating")
      .eq("player_id", playerId)
      .maybeSingle();
    return data?.rating ?? ELO_START;
  }

  async function writeRating(playerId: string, rating: number, result: "win" | "draw" | "loss") {
    const { data } = await admin
      .from("gaming_chess_ratings")
      .select("best_rating, games_played, wins, draws, losses")
      .eq("player_id", playerId)
      .maybeSingle();
    const best = Math.max(data?.best_rating ?? rating, rating);
    const games_played = (data?.games_played ?? 0) + 1;
    const wins = (data?.wins ?? 0) + (result === "win" ? 1 : 0);
    const draws = (data?.draws ?? 0) + (result === "draw" ? 1 : 0);
    const losses = (data?.losses ?? 0) + (result === "loss" ? 1 : 0);
    await admin.from("gaming_chess_ratings").upsert({
      player_id: playerId,
      rating,
      best_rating: best,
      games_played,
      wins,
      draws,
      losses,
    });
  }

  const participants: Array<{ match_id: string; player_id: string; placement: number; points_awarded: number; rating_before: number; rating_after: number }> = [];
  const scoring: Record<string, { points: number; rating_before: number; rating_after: number }> = {};

  if (game.mode === "bot") {
    const key = result.winner === "white"
      ? `win_${difficultyOf(game.bot_difficulty)}`
      : result.winner === "draw"
        ? "draw"
        : "loss";
    const points = result.winner === "white"
      ? BOT_WIN_POINTS[difficultyOf(game.bot_difficulty)]
      : result.winner === "draw"
        ? BOT_DRAW_POINTS
        : LOSS_POINTS;
    const before = await readRating(game.white_player_id);
    const opponent = BOT_RATINGS[difficultyOf(game.bot_difficulty)];
    const score = gameScore(result.winner, "white");
    const after = Math.max(ELO_FLOOR, before + eloDelta(before, opponent, score));
    await writeRating(game.white_player_id, after, result.winner === "white" ? "win" : result.winner === "draw" ? "draw" : "loss");
    participants.push({
      match_id: match.id,
      player_id: game.white_player_id,
      placement: BOT_PLACEMENTS[key] ?? BOT_PLACEMENTS.loss,
      points_awarded: points,
      rating_before: before,
      rating_after: after,
    });
    scoring[game.white_player_id] = { points, rating_before: before, rating_after: after };
  } else {
    if (result.winner === "draw") {
      for (const playerId of [game.white_player_id, game.black_player_id!]) {
        const before = await readRating(playerId);
        const opponent = playerId === game.white_player_id
          ? await readRating(game.black_player_id!)
          : await readRating(game.white_player_id);
        const score = 0.5;
        const after = Math.max(ELO_FLOOR, before + eloDelta(before, opponent, score));
        await writeRating(playerId, after, "draw");
        participants.push({
          match_id: match.id,
          player_id: playerId,
          placement: 3,
          points_awarded: PVP_DRAW_POINTS,
          rating_before: before,
          rating_after: after,
        });
        scoring[playerId] = { points: PVP_DRAW_POINTS, rating_before: before, rating_after: after };
      }
    } else {
      const winId = result.winner === "white" ? game.white_player_id : game.black_player_id;
      const loseId = result.winner === "white" ? game.black_player_id : game.white_player_id;
      const streak = await pvpStreak(admin, winId!);
      const bonus = Math.min(streak, STREAK_BONUS_MAX / STREAK_BONUS_STEP) * STREAK_BONUS_STEP;
      const winPoints = PVP_WIN_POINTS + bonus;
      const winBefore = await readRating(winId!);
      const loseBefore = await readRating(loseId!);
      const winScore = 1;
      const loseScore = 0;
      const winAfter = Math.max(ELO_FLOOR, winBefore + eloDelta(winBefore, loseBefore, winScore));
      await writeRating(winId!, winAfter, "win");
      const loseAfter = Math.max(ELO_FLOOR, loseBefore + eloDelta(loseBefore, winBefore, loseScore));
      await writeRating(loseId!, loseAfter, "loss");
      participants.push({ match_id: match.id, player_id: winId!, placement: 1, points_awarded: winPoints, rating_before: winBefore, rating_after: winAfter });
      participants.push({ match_id: match.id, player_id: loseId!, placement: 4, points_awarded: LOSS_POINTS, rating_before: loseBefore, rating_after: loseAfter });
      scoring[winId!] = { points: winPoints, rating_before: winBefore, rating_after: winAfter };
      scoring[loseId!] = { points: LOSS_POINTS, rating_before: loseBefore, rating_after: loseAfter };
    }
  }

  const { error: participantsError } = await admin.from("gaming_match_participants").insert(participants);
  if (participantsError) throw new Error("No se pudo registrar la puntuación");

  const { error: confirmError } = await admin
    .from("gaming_matches")
    .update({ status: "confirmed", confirmed_by: userId, confirmed_at: new Date().toISOString() })
    .eq("id", match.id);
  if (confirmError) throw new Error("No se pudo confirmar la partida");

  const { error: gameError } = await admin
    .from("gaming_chess_games")
    .update({
      status: "finished",
      winner: result.winner,
      fen: chess.fen(),
      pgn: chess.pgn(),
      match_id: match.id,
      finished_at: new Date().toISOString(),
    })
    .eq("id", game.id);
  if (gameError) throw new Error("No se pudo cerrar la partida de ajedrez");

  return scoring;
}

// Realtime: un canal por partida para que el otro jugador vea los movimientos
// y cambios de estado en vivo sin polling.
const openChannels = new Map<string, any>();

async function broadcast(
  realtime: ReturnType<typeof createClient>,
  gameId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  const topic = `chess:${gameId}`;
  let channel = openChannels.get(topic);
  if (!channel) {
    channel = realtime.channel(topic, { config: { broadcast: { self: false } } });
    openChannels.set(topic, channel);
  }
  if (channel.subscriptionState !== "SUBSCRIBED") {
    await new Promise<void>((resolve) => {
      channel.subscribe((status: string) => {
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") resolve();
      });
    });
  }
  await channel.send({ type: "broadcast", event, payload });
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

    let body: Record<string, any> = {};
    try {
      body = await request.json();
    } catch {
      // Sin cuerpo — no hay acción a ejecutar.
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const playerId = await resolvePlayerId(admin, user);
    if (!playerId) return json({ error: "Sesión sin identidad de Discord" }, 400);

    const action = body.action;
    if (action === "start_bot") {
      const difficulty = ["easy", "medium", "hard"].includes(body.difficulty) ? body.difficulty : "medium";
      const tournamentId = await ensureTournament(admin);
      const { data: game, error } = await admin
        .from("gaming_chess_games")
        .insert({
          tournament_id: tournamentId,
          white_player_id: playerId,
          mode: "bot",
          bot_difficulty: difficulty,
          status: "active",
          started_at: new Date().toISOString(),
        })
        .select(GAME_SELECT)
        .single();
      if (error) {
        console.error(error);
        return json({ error: "Error al iniciar la partida" }, 500);
      }
      return json({ game });
    }

    if (action === "create_challenge") {
      const opponent = typeof body.opponent === "string" ? body.opponent.trim() : "";
      if (!opponent) return json({ error: "Elegí un rival por su nombre de usuario" }, 400);

      const { data: rival } = await admin
        .from("gaming_players")
        .select("id")
        .eq("username", opponent)
        .maybeSingle();
      if (!rival) return json({ error: "Ese jugador no existe" }, 404);
      if (rival.id === playerId) return json({ error: "No podés desafiarte a vos mismo" }, 400);

      let existing = null;
      {
        const { data: forward } = await admin
          .from("gaming_chess_games")
          .select("id")
          .in("status", ["pending", "active"])
          .or(
            `and(white_player_id.eq.${playerId},black_player_id.eq.${rival.id}),` +
              `and(white_player_id.eq.${rival.id},black_player_id.eq.${playerId})`,
          );
        if (forward?.length) existing = forward;
      }
      if (existing) return json({ error: "Ya hay una partida contra ese rival" }, 400);

      const tournamentId = await ensureTournament(admin);
      const { data: game, error: challengeError } = await admin
        .from("gaming_chess_games")
        .insert({
          tournament_id: tournamentId,
          white_player_id: playerId,
          black_player_id: rival.id,
          mode: "pvp",
          status: "pending",
        })
        .select(GAME_SELECT)
        .single();
      if (challengeError) {
        console.error(challengeError);
        return json({ error: "No se pudo crear el desafío" }, 500);
      }
      return json({ game });
    }

    if (action === "accept" || action === "decline") {
      const gameId = typeof body.id === "string" ? body.id : "";
      if (!gameId) return json({ error: "Esa partida no existe" }, 404);

      const { data: game } = await admin.from("gaming_chess_games").select(GAME_SELECT).eq("id", gameId).maybeSingle();
      if (!game) return json({ error: "Esa partida no existe" }, 404);
      if (game.white_player_id !== playerId && game.black_player_id !== playerId) {
        return json({ error: "Solo puede responder el jugador desafiado" }, 403);
      }
      if (game.status !== "pending") return json({ error: "La partida no está activa" }, 400);

      if (action === "accept") {
        if (game.black_player_id !== playerId) {
          return json({ error: "Solo puede aceptar el jugador desafiado" }, 403);
        }
        const { data: accepted, error: acceptError } = await admin
          .from("gaming_chess_games")
          .update({ status: "active", started_at: new Date().toISOString() })
          .eq("id", gameId)
          .select(GAME_SELECT)
          .single();
        if (acceptError) {
          console.error(acceptError);
          return json({ error: "No se pudo aceptar el desafío" }, 500);
        }
        await broadcast(supabase, gameId, "status", { status: "active", game: accepted });
        return json({ game: accepted });
      }

      const { error: declineError } = await admin.from("gaming_chess_games").delete().eq("id", gameId);
      if (declineError) {
        console.error(declineError);
        return json({ error: "No se pudo rechazar el desafío" }, 500);
      }
      await broadcast(supabase, gameId, "status", { status: "declined" });
      return json({ ok: true });
    }

    if (action === "state") {
      const gameId = typeof body.id === "string" ? body.id : "";
      if (!gameId) return json({ error: "Esa partida no existe" }, 404);

      const { data: game } = await admin.from("gaming_chess_games").select(GAME_SELECT).eq("id", gameId).maybeSingle();
      if (!game) return json({ error: "Esa partida no existe" }, 404);

      const { data: rating } = await admin
        .from("gaming_chess_ratings")
        .select("rating, best_rating, games_played, wins, draws, losses")
        .eq("player_id", playerId)
        .maybeSingle();

      let scoring: Record<string, { points: number; rating_before: number; rating_after: number }> = {};
      if (game.status === "finished" && game.match_id) {
        const { data: participants } = await admin
          .from("gaming_match_participants")
          .select("player_id, points_awarded, rating_before, rating_after")
          .eq("match_id", game.match_id);
        for (const p of participants ?? []) {
          scoring[p.player_id] = {
            points: p.points_awarded,
            rating_before: p.rating_before,
            rating_after: p.rating_after,
          };
        }
      }

      return json({ game, scoring, rating: rating ?? { rating: ELO_START, best_rating: ELO_START, games_played: 0, wins: 0, draws: 0, losses: 0 } });
    }

    if (action === "my_games") {
      const mine = await admin
        .from("gaming_chess_games")
        .select("id, mode, bot_difficulty, status, winner, created_at, white_player_id(display_name, username), black_player_id(display_name, username)")
        .eq("white_player_id", playerId)
        .in("status", ["pending", "active"])
        .order("created_at", { ascending: false });
      const theirs = await admin
        .from("gaming_chess_games")
        .select("id, mode, bot_difficulty, status, winner, created_at, white_player_id(display_name, username), black_player_id(display_name, username)")
        .eq("black_player_id", playerId)
        .in("status", ["pending", "active"])
        .order("created_at", { ascending: false });
      const games = [...(mine.data ?? []), ...(theirs.data ?? [])].sort((a, b) =>
        String(b.created_at).localeCompare(String(a.created_at)),
      );
      const { data: rating } = await admin
        .from("gaming_chess_ratings")
        .select("rating, best_rating, games_played, wins, draws, losses")
        .eq("player_id", playerId)
        .maybeSingle();
      return json({
        games,
        rating: rating ?? { rating: ELO_START, best_rating: ELO_START, games_played: 0, wins: 0, draws: 0, losses: 0 },
      });
    }

    if (action === "move") {
      const gameId = typeof body.id === "string" ? body.id : "";
      const from = typeof body.from === "string" ? body.from.toLowerCase() : "";
      const to = typeof body.to === "string" ? body.to.toLowerCase() : "";
      const promotion = typeof body.promotion === "string" ? body.promotion.toLowerCase() : undefined;
      if (!gameId) return json({ error: "Esa partida no existe" }, 404);
      if (!from || !to) return json({ error: "Movimiento inválido" }, 400);

      const { data: game } = await admin.from("gaming_chess_games").select(GAME_SELECT).eq("id", gameId).maybeSingle();
      if (!game) return json({ error: "Esa partida no existe" }, 404);
      if (game.status !== "active") return json({ error: "La partida no está activa" }, 400);
      if (game.white_player_id !== playerId && game.black_player_id !== playerId) {
        return json({ error: "No sos parte de esta partida" }, 403);
      }

      const chess = loadChess(game);

      if (game.mode === "pvp") {
        const myColor = game.white_player_id === playerId ? "w" : "b";
        if (chess.turn() !== myColor) return json({ error: "No es tu turno" }, 400);
      } else if (game.white_player_id !== playerId) {
        return json({ error: "No es tu turno" }, 400);
      }

      const applied = applyMove(chess, from, to, promotion);
      if (!applied) return json({ error: "Movimiento inválido" }, 400);

      const result = gameResult(chess);
      if (result) {
        let scoring: Record<string, { points: number; rating_before: number; rating_after: number }> = {};
        try {
          scoring = await finalizeGame(admin, user.id, game, chess, result);
        } catch (finalizeError) {
          console.error(finalizeError);
          return json({ error: "Error al procesar la partida" }, 500);
        }
        await broadcast(supabase, gameId, "move", { fen: chess.fen(), from, to, winner: result.winner });
        await broadcast(supabase, gameId, "status", { status: "finished", winner: result.winner });
        return json({ fen: chess.fen(), pgn: chess.pgn(), winner: result.winner, gameOver: true, scoring });
      }

      const { error: updateError } = await admin
        .from("gaming_chess_games")
        .update({ fen: chess.fen(), pgn: chess.pgn() })
        .eq("id", gameId);
      if (updateError) {
        console.error(updateError);
        return json({ error: "Error al guardar el movimiento" }, 500);
      }
      await broadcast(supabase, gameId, "move", { fen: chess.fen(), from, to });
      return json({ fen: chess.fen(), pgn: chess.pgn(), winner: null, gameOver: false });
    }

    if (action === "resign") {
      const gameId = typeof body.id === "string" ? body.id : "";
      if (!gameId) return json({ error: "Esa partida no existe" }, 404);

      const { data: game } = await admin.from("gaming_chess_games").select(GAME_SELECT).eq("id", gameId).maybeSingle();
      if (!game) return json({ error: "Esa partida no existe" }, 404);
      if (game.status !== "active") return json({ error: "La partida no está activa" }, 400);
      if (game.white_player_id !== playerId && game.black_player_id !== playerId) {
        return json({ error: "No sos parte de esta partida" }, 403);
      }

      const chess = loadChess(game);
      const mySide = game.white_player_id === playerId ? "white" : "black";
      const result = { winner: mySide === "white" ? ("black" as const) : ("white" as const) };
      let scoring: Record<string, { points: number; rating_before: number; rating_after: number }> = {};
      try {
        scoring = await finalizeGame(admin, user.id, game, chess, result);
      } catch (finalizeError) {
        console.error(finalizeError);
        return json({ error: "Error al procesar la partida" }, 500);
      }
      await broadcast(supabase, gameId, "status", { status: "finished", winner: result.winner });
      return json({ winner: result.winner, gameOver: true, scoring });
    }

    return json({ error: "Acción desconocida" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: "Error al procesar la partida" }, 500);
  }
});