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

const GAME_SELECT = [
  "id",
  "tournament_id",
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
async function finalizeGame(
  admin: ReturnType<typeof createClient>,
  userId: string,
  game: { id: string; mode: string; bot_difficulty: string | null; white_player_id: string; black_player_id: string | null; fen: string; pgn: string | null },
  chess: Chess,
  result: { winner: "white" | "black" | "draw" },
) {
  const tournamentId = await ensureTournament(admin);

  const { data: match, error: matchError } = await admin
    .from("gaming_matches")
    .insert({ tournament_id: tournamentId, status: "pending" })
    .select("id")
    .single();
  if (matchError || !match) throw new Error("No se pudo crear la partida");

  const participants: Array<{ match_id: string; player_id: string; placement: number }> = [];
  if (game.mode === "bot") {
    const key = result.winner === "white"
      ? `win_${game.bot_difficulty}`
      : result.winner === "draw"
        ? "draw"
        : "loss";
    participants.push({
      match_id: match.id,
      player_id: game.white_player_id,
      placement: BOT_PLACEMENTS[key] ?? BOT_PLACEMENTS.loss,
    });
  } else {
    if (result.winner === "draw") {
      participants.push({ match_id: match.id, player_id: game.white_player_id, placement: 3 });
      participants.push({ match_id: match.id, player_id: game.black_player_id!, placement: 3 });
    } else {
      const winId = result.winner === "white" ? game.white_player_id : game.black_player_id;
      const loseId = result.winner === "white" ? game.black_player_id : game.white_player_id;
      participants.push({ match_id: match.id, player_id: winId!, placement: 1 });
      participants.push({ match_id: match.id, player_id: loseId!, placement: 4 });
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
      finished_at: new Date().toISOString(),
    })
    .eq("id", game.id);
  if (gameError) throw new Error("No se pudo cerrar la partida de ajedrez");
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
      return json({ game });
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
      return json({ games });
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
        try {
          await finalizeGame(admin, user.id, game, chess, result);
        } catch (finalizeError) {
          console.error(finalizeError);
          return json({ error: "Error al procesar la partida" }, 500);
        }
        await broadcast(supabase, gameId, "move", { fen: chess.fen(), from, to, winner: result.winner });
        await broadcast(supabase, gameId, "status", { status: "finished", winner: result.winner });
        return json({ fen: chess.fen(), pgn: chess.pgn(), winner: result.winner, gameOver: true });
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
      try {
        await finalizeGame(admin, user.id, game, chess, result);
      } catch (finalizeError) {
        console.error(finalizeError);
        return json({ error: "Error al procesar la partida" }, 500);
      }
      await broadcast(supabase, gameId, "status", { status: "finished", winner: result.winner });
      return json({ winner: result.winner, gameOver: true });
    }

    return json({ error: "Acción desconocida" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: "Error al procesar la partida" }, 500);
  }
});