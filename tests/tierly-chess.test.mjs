import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20260829120000_add_chess_module.sql", import.meta.url),
  "utf8",
);
const edge = await readFile(
  new URL("../supabase/functions/chess/index.ts", import.meta.url),
  "utf8",
);
const supabaseConfig = await readFile(
  new URL("../supabase/config.toml", import.meta.url),
  "utf8",
);
const page = await readFile(new URL("../tierly/index.html", import.meta.url), "utf8");
const chessJs = await readFile(new URL("../tierly/chess.js", import.meta.url), "utf8");
const app = await readFile(new URL("../tierly/app.js", import.meta.url), "utf8");

// ---------------------------------------------------------------------------
// Migración: gaming_chess_games
// ---------------------------------------------------------------------------

test("gaming_chess_games enables RLS and grants nobody via REST", () => {
  assert.match(migration, /create table public\.gaming_chess_games/);
  assert.match(migration, /alter table public\.gaming_chess_games enable row level security/);
  assert.match(migration, /revoke all on table public\.gaming_chess_games from anon, authenticated/);
  assert.doesNotMatch(migration, /gaming_chess_games[\s\S]{0,200}grant [^;]* to anon/);
});

test("gaming_chess_games has the full column surface", () => {
  for (const column of [
    "id", "tournament_id", "white_player_id", "black_player_id", "mode",
    "bot_difficulty", "status", "winner", "fen", "pgn", "started_at", "finished_at",
    "created_at", "updated_at",
  ]) {
    assert.match(migration, new RegExp(`${column} `));
  }
  assert.match(migration, /fen text not null default 'rnbqkbnr\/pppppppp\/8\/8\/8\/8\/PPPPPPPP\/RNBQKBNR w KQkq - 0 1'/);
});

test("gaming_chess_games enforces mode, difficulty, status and winner checks", () => {
  assert.match(migration, /mode text not null check \(mode in \('bot', 'pvp'\)\)/);
  assert.match(migration, /mode = 'bot' and bot_difficulty in \('easy', 'medium', 'hard'\)/);
  assert.match(migration, /mode = 'pvp' and bot_difficulty is null/);
  assert.match(migration, /status text not null default 'pending' check \(status in \('pending', 'active', 'finished'\)\)/);
  assert.match(migration, /winner text check \(winner in \('white', 'black', 'draw'\)\)/);
});

test("gaming_chess_games touches updated_at and indexes the hot queries", () => {
  assert.match(migration, /gaming_chess_games_touch before update on public\.gaming_chess_games/);
  assert.match(migration, /execute function public\.touch_updated_at\(\)/);
  assert.match(migration, /create index gaming_chess_games_white_idx/);
  assert.match(migration, /create index gaming_chess_games_black_idx/);
  assert.match(migration, /create index gaming_chess_games_status_idx/);
});

test("chess tournament lookup is security definer with a locked search_path, anchored to the season", () => {
  const fn = migration.match(/create or replace function public\.ensure_gaming_season_tournament[\s\S]*?\$\$;/)?.[0] ?? "";
  assert.match(fn, /p_game text/);
  assert.match(fn, /security definer/);
  assert.match(fn, /set search_path = ''/);
  assert.match(fn, /public\.gaming_season_start\(\)/);
  assert.match(fn, /format = 'elimination'/);
  assert.match(fn, /No hay organización configurada para el torneo de ajedrez/);
});

// ---------------------------------------------------------------------------
// Edge function: chess
// ---------------------------------------------------------------------------

test("chess runs without JWT verification and validates the session itself", () => {
  assert.match(supabaseConfig, /\[functions\.chess\][\s\S]*?verify_jwt\s*=\s*false/);
  assert.match(edge, /auth\.getUser\(\)/);
  assert.match(edge, /Sesión requerida/);
  assert.match(edge, /Sesión inválida/);
  assert.match(edge, /Sesión sin identidad de Discord/);
});

test("chess uses the service-role channel for gameplay writes and hardcodes no secrets", () => {
  assert.match(edge, /Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  assert.match(edge, /Deno\.env\.get\("SUPABASE_ANON_KEY"\)/);
  assert.doesNotMatch(edge, /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\./);
});

test("the browser never decides results — chess.js recomputes games server-side", () => {
  assert.match(edge, /import \{ Chess \} from "npm:chess\.js@1\.4\.0"/);
  assert.match(edge, /function loadChess/);
  assert.match(edge, /function applyMove/);
  assert.match(edge, /function gameResult/);
});

test("scoring only flows through the pending -> confirmed gaming_matches pipeline", () => {
  assert.match(edge, /\.insert\(\{ tournament_id: tournamentId, status: "pending" \}\)/);
  assert.match(edge, /\.update\(\{ status: "confirmed",/);
  assert.match(edge, /function finalizeGame/);
});

test("bot difficulty maps to the exact spec placements", () => {
  assert.match(edge, /const BOT_PLACEMENTS = \{ win_hard: 1, win_medium: 2, win_easy: 3, draw: 3, loss: 4 \};/);
  assert.match(edge, /placement: BOT_PLACEMENTS\[key\] \?\? BOT_PLACEMENTS\.loss/);
});

test("PvP awards 1/4 for winner/loser and 3/3 for a draw", () => {
  assert.match(edge, /const winId = result\.winner === "white" \? game\.white_player_id : game\.black_player_id;/);
  assert.match(edge, /player_id: (winId|loseId)!, placement: (1|4) \}/);
  assert.match(edge, /player_id: game\.black_player_id!, placement: 3 \}/);
});

test("gameplay state changes broadcast over a per-game chess topic", () => {
  assert.match(edge, /const topic = `chess:\$\{gameId\}`;/);
  assert.match(edge, /realtime\.channel\(topic, \{ config: \{ broadcast: \{ self: false \} \} \}\)/);
  assert.match(edge, /channel\.send\(\{ type: "broadcast", event, payload \}\)/);
});

test("duplicate challenges are checked both ways and the players' turn order is enforced", () => {
  assert.match(edge, /white_player_id\.eq\.\$\{playerId\},black_player_id\.eq\.\$\{rival\.id\}/);
  assert.match(edge, /white_player_id\.eq\.\$\{rival\.id\},black_player_id\.eq\.\$\{playerId\}/);
  assert.match(edge, /Ya hay una partida contra ese rival/);
  assert.match(edge, /Solo puede aceptar el jugador desafiado/);
  assert.match(edge, /No es tu turno/);
  assert.match(edge, /Movimiento inválido/);
});

test("chess responds in Spanish and never leaks exception details", () => {
  assert.match(edge, /console\.error\(error\)/);
  assert.match(edge, /return json\(\{ error: "Error al procesar la partida" \}, 500\)/);
  assert.doesNotMatch(edge, /json\(\{ error: error instanceof Error \? error\.message/);
  assert.match(edge, /Esa partida no existe/);
  assert.match(edge, /Acción desconocida/);
});

// ---------------------------------------------------------------------------
// Browser: index.html + chess.js + app.js
// ---------------------------------------------------------------------------

test("index.html wires the chess view, chessground assets and versioned modules", () => {
  assert.match(page, /data-view="chess"/);
  assert.match(page, /id="lb-chess-title"/);
  assert.match(page, /id="lb-chess"/);
  assert.match(page, /unpkg\.com\/chessground@9\.2\.1\/assets\/chessground\.base\.css/);
  assert.match(page, /unpkg\.com\/chessground@9\.2\.1\/assets\/chessground\.brown\.css/);
  assert.match(page, /unpkg\.com\/chessground@9\.2\.1\/assets\/chessground\.cburnett\.css/);
  assert.match(chessJs, /import \{ Chessground \} from "https:\/\/cdn\.jsdelivr\.net\/npm\/chessground@9\.2\.1\/dist\/chessground\.min\.js"/);
});

test("chess.js and app.js ship with matching cache-busting versions", () => {
  const chessVersion = page.match(/chess\.js\?v=([^"']+)/)?.[1];
  const appVersion = page.match(/app\.js\?v=([^"']+)/)?.[1];
  assert.ok(chessVersion);
  assert.equal(appVersion, chessVersion);
});

test("the app exposes a TierlyBridge so chess.js can reuse supabase, strings and view switching", () => {
  assert.match(app, /window\.TierlyBridge\s*=\s*\{/);
  assert.match(app, /supabase,/);
  assert.match(app, /t:\s*\(key\)\s*=>\s*t\(key\),/);
  assert.match(app, /session:\s*\(\)\s*=>\s*currentSession,/);
  assert.match(app, /player:\s*\(\)\s*=>\s*currentPlayer,/);
  assert.match(app, /switchView:\s*\(view\)\s*=>\s*switchView\(view\),/);
});

test("the nav gains a chess entry with the swords icon", () => {
  assert.match(app, /data-view="chess"><i data-lucide="swords"/);
});

test("chess strings exist in both locales, including lbBack for the back button", () => {
  assert.match(app, /navChess: "Chess"/);
  assert.match(app, /navChess: "Ajedrez"/);
  assert.match(app, /chessYouWin: "You win!"/);
  assert.match(app, /chessYouWin: "¡Ganaste!"/);
  assert.match(app, /lbBack: "Back"/);
  assert.match(app, /lbBack: "Volver"/);
});

test("chess.js recomputes legal moves with chess.js and drives Stockfish on a worker", () => {
  assert.match(chessJs, /import \{ Chess \} from "https:\/\/cdn\.jsdelivr\.net\/npm\/chess\.js@1\.4\.0\/dist\/esm\/chess\.js"/);
  assert.match(chessJs, /import \{ Chessground \} from "https:\/\/cdn\.jsdelivr\.net\/npm\/chessground@9\.2\.1\/dist\/chessground\.min\.js"/);
  assert.match(chessJs, /board = Chessground\(wrap/);
  assert.match(chessJs, /const dests = new Map\(\)/);
  assert.match(chessJs, /new Worker\(VENDOR_ENGINE_JS\)/);
  assert.match(chessJs, /VENDOR_ENGINE_WASM = "\/tierly\/vendor\/stockfish-18-lite-single\.wasm"/);
  assert.doesNotMatch(chessJs, /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\./);
});

test("the public browser code never embeds secrets", () => {
  for (const source of [app, chessJs]) {
    assert.doesNotMatch(source, /service[_-]?role/i);
    assert.doesNotMatch(source, /LUMA_API_KEY/);
    assert.doesNotMatch(source, /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\./);
  }
});

test("the bundled Stockfish assets are present and the engine JS is a real loader", async () => {
  const engineJs = await stat(new URL("../tierly/vendor/stockfish-18-lite-single.js", import.meta.url));
  const engineWasm = await stat(new URL("../tierly/vendor/stockfish-18-lite-single.wasm", import.meta.url));
  assert.ok(engineJs.size > 10_000, "engine loader is too small to be real");
  assert.ok(engineWasm.size > 1_000_000, "stockfish wasm must exist and be larger than 1MB");
});