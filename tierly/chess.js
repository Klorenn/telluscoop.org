// tierly/chess.js · Módulo de ajedrez Tierly (sin bundler).
// - Bot vs Stockfish (tres dificultades) y PvP por Supabase Realtime.
// - Anti-cheat: el browser nunca decide un resultado. Cada movimiento
//   (humano Y bot) se POSTea al edge function /functions/v1/chess, que lo
//   rejuega con chess.js y solo confirma la partida cuando el server dice
//   game over. El puntaje entra por gaming_matches -> 'confirmed'.
import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/dist/esm/chess.js";
import { Chessground } from "https://cdn.jsdelivr.net/npm/chessground@9.2.1/dist/chessground.min.js";

(() => {
  "use strict";

  const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const VENDOR_ENGINE_JS = "/tierly/vendor/stockfish-18-lite-single.js";
  const VENDOR_ENGINE_WASM = "/tierly/vendor/stockfish-18-lite-single.wasm";

  const DIFFICULTY_MAP = {
    easy: { skill: 3, movetime: 400 },
    medium: { skill: 10, movetime: 700 },
    hard: { skill: 17, movetime: 1000 },
  };
  const DIFFICULTY_ORDER = ["easy", "medium", "hard"];

  const bridge = () => window.TierlyBridge ?? null;
  const t = (key) => { const b = bridge(); return b?.t ? b.t(key) : key; };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const section = document.querySelector('.lb-view[data-view="chess"]');
  const container = () => document.querySelector("#lb-chess");
  const titleEl = () => document.querySelector("#lb-chess-title");

  let current = null;
  let selectedDifficulty = "medium";
  let board = null;
  let realtimeChannel = null;

  function bridgePlayerId() {
    return bridge()?.player?.()?.id ?? null;
  }

  // ---- Invocación al edge function (le pasa el session automáticamente) ----
  async function invoke(payload) {
    try {
      const b = bridge();
      if (!b?.supabase) return { error: t("chessError") };
      const session = await b.supabase.auth.getSession();
      const accessToken = session?.data?.session?.access_token;
      if (!accessToken) return { error: t("chessError") };
      let response;
      try {
        response = await fetch(`${b.supabaseConfig?.url ?? ""}/functions/v1/chess`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: b.supabaseConfig?.anonKey ?? "",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      } catch (networkError) {
        console.error("[CHESS] network failed", networkError);
        return { error: t("chessError") };
      }
      const rawText = await response.text();
      let body = null;
      try { body = JSON.parse(rawText); } catch { /* cuerpo no-JSON */ }
      if (!response.ok) {
        console.error("[CHESS] raw", response.status, rawText.slice(0, 300));
        return { error: body?.error || t("chessError") };
      }
      if (body?.error) return { error: body.error };
      return { data: body };
    } catch (error) {
      console.error("[CHESS] invoke failed", error);
      return { error: t("chessError") };
    }
  }

  function setStatus(message) {
    const el = document.querySelector("#lb-chess-status");
    if (el) el.textContent = message;
  }

  function setLobbyError(message) {
    const el = document.querySelector("#lb-chess-error");
    if (!el) return;
    el.hidden = false;
    el.textContent = message;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.hidden = true; }, 4000);
  }

  // ---------------- Lobby / lista de partidas ----------------
  function difficultyLabel(d) {
    return t("chess" + d.charAt(0).toUpperCase() + d.slice(1));
  }

  function renderLobby() {
    const el = container();
    if (!el) return;
    el.innerHTML = `
      <div class="lb-chess-lobby-head">
        <button type="button" id="lb-chess-howto" class="lb-chess-btn">${t("chessHowTo")}</button>
      </div>
      <div class="lb-chess-grid">
        <div class="lb-chess-card">
          <h3>${t("chessBotTitle")}</h3>
          <div class="lb-chess-difficulty" id="lb-chess-difficulty">
            ${DIFFICULTY_ORDER.map((d) =>
              `<button type="button" data-difficulty="${d}" class="lb-chess-chip${selectedDifficulty === d ? " is-active" : ""}">${difficultyLabel(d)}</button>`).join("")}
          </div>
          <button type="button" id="lb-chess-start-bot" class="lb-chess-btn lb-chess-btn-primary">${t("chessStart")}</button>
        </div>
        <div class="lb-chess-card">
          <h3>${t("chessChallengeTitle")}</h3>
          <div class="lb-chess-challenge">
            <input id="lb-chess-opponent" class="lb-chess-input" placeholder="${esc(t("chessChallengePlaceholder"))}" autocomplete="off" />
            <button type="button" id="lb-chess-challenge" class="lb-chess-btn lb-chess-btn-primary">${t("chessChallengeBtn")}</button>
          </div>
        </div>
      </div>
      <h3 class="lb-chess-mygames-title">${t("chessMyGames")}</h3>
      <div id="lb-chess-mygames" class="lb-chess-mygames">${esc(t("chessLoading"))}</div>
      <p id="lb-chess-error" class="lb-chess-error" hidden></p>`;

    el.querySelectorAll("[data-difficulty]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedDifficulty = btn.dataset.difficulty;
        el.querySelectorAll("[data-difficulty]").forEach((b) => b.classList.toggle("is-active", b === btn));
      });
    });
    el.querySelector("#lb-chess-start-bot").addEventListener("click", () => startBotGame());
    el.querySelector("#lb-chess-challenge").addEventListener("click", () => submitChallenge());
    el.querySelector("#lb-chess-howto").addEventListener("click", () => openTutorial());
    const input = el.querySelector("#lb-chess-opponent");
    input.addEventListener("keydown", (event) => { if (event.key === "Enter") submitChallenge(); });

    refreshMyGames();
  }

  function gameLabel(game) {
    if (game.mode === "bot") return `${t("chessBot")} · ${difficultyLabel(game.bot_difficulty || "medium")}`;
    const white = game.white_player_id?.display_name || game.white_player_id?.username || "?";
    const black = game.black_player_id?.display_name || game.black_player_id?.username || "?";
    return `${esc(white)} vs ${esc(black)}`;
  }

  async function refreshMyGames() {
    const list = document.querySelector("#lb-chess-mygames");
    if (!list) return;
    const result = await invoke({ action: "my_games" });
    const games = result.data?.games || [];
    if (result.error || !games.length) {
      list.innerHTML = `<p class="lb-chess-empty">${esc(t("chessEmpty"))}</p>`;
      return;
    }
    const me = bridgePlayerId();
    list.innerHTML = games.map((game) => {
      const mine = game.white_player_id?.id === me ? "white" : "black";
      const pendingPvp = game.mode === "pvp" && game.status === "pending";
      const tag = pendingPvp ? t("chessPending") : game.status === "active" ? t("chessActive") : "?";
      let actions = "";
      if (pendingPvp && mine === "black") {
        actions = `
          <button type="button" class="lb-chess-btn lb-chess-btn-small" data-action="accept" data-id="${game.id}">${t("chessAccept")}</button>
          <button type="button" class="lb-chess-btn lb-chess-btn-small lb-chess-btn-danger" data-action="decline" data-id="${game.id}">${t("chessDecline")}</button>`;
      } else if (pendingPvp && mine === "white") {
        actions = `<button type="button" class="lb-chess-btn lb-chess-btn-small lb-chess-btn-danger" data-action="decline" data-id="${game.id}">${t("chessCancel")}</button>`;
      } else {
        actions = `<button type="button" class="lb-chess-btn lb-chess-btn-small" data-action="play" data-id="${game.id}">${t("chessPlay")}</button>`;
      }
      return `<div class="lb-chess-game-row">
        <span class="lb-chess-game-info">${gameLabel(game)}</span>
        <span class="lb-chess-tag">${tag}</span>${actions}
      </div>`;
    }).join("");
    list.querySelectorAll("button").forEach((btn) => btn.addEventListener("click", onMyGameAction));
  }

  async function onMyGameAction(event) {
    const gameId = event.currentTarget.dataset.id;
    const action = event.currentTarget.dataset.action;
    if (action === "accept") {
      const result = await invoke({ action: "accept", id: gameId });
      if (result.data?.game) openGame(result.data.game);
      else setLobbyError(result.error);
    } else if (action === "decline") {
      await invoke({ action: "decline", id: gameId });
      refreshMyGames();
    } else if (action === "play") {
      const result = await invoke({ action: "state", id: gameId });
      if (result.data?.game) openGame(result.data.game);
      else setLobbyError(result.error);
    }
  }

  async function submitChallenge() {
    const input = document.querySelector("#lb-chess-opponent");
    const opponent = input?.value?.trim() || "";
    if (!opponent) { setLobbyError(t("chessChallengePlaceholder")); return; }
    const result = await invoke({ action: "create_challenge", opponent });
    if (result.data?.game) {
      input.value = "";
      openGame(result.data.game);
    } else {
      setLobbyError(result.error);
    }
  }

  async function startBotGame() {
    const result = await invoke({ action: "start_bot", difficulty: selectedDifficulty });
    if (result.data?.game) openGame(result.data.game);
    else setLobbyError(result.error);
  }

  // ---------------- Tutorial ---------------
  function openTutorial() {
    const dialog = document.querySelector("#lb-chess-tutorial");
    if (!dialog) return;
    document.querySelector("#lb-chess-tutorial-title").textContent = t("chessTutorialTitle");
    document.querySelector("#lb-chess-tutorial-body").innerHTML = `
      <div class="lb-chess-tutorial-section">
        <h3>${t("chessTutorialObjectiveTitle")}</h3>
        <p>${t("chessTutorialObjectiveBody")}</p>
      </div>
      <div class="lb-chess-tutorial-section">
        <h3>${t("chessTutorialBotTitle")}</h3>
        <p>${t("chessTutorialBotBody")}</p>
      </div>
      <div class="lb-chess-tutorial-section">
        <h3>${t("chessTutorialPvpTitle")}</h3>
        <p>${t("chessTutorialPvpBody")}</p>
      </div>
      <div class="lb-chess-tutorial-section">
        <h3>${t("chessTutorialControlsTitle")}</h3>
        <p>${t("chessTutorialControlsBody")}</p>
      </div>
      <div class="lb-chess-tutorial-section">
        <h3>${t("chessTutorialScoresTitle")}</h3>
        <p>${t("chessTutorialScoresBody")}</p>
      </div>`;
    document.querySelector("#lb-chess-tutorial-gotit").textContent = t("chessTutorialGotIt");
    dialog.showModal();
  }

  function wireTutorialDialog() {
    const dialog = document.querySelector("#lb-chess-tutorial");
    if (!dialog) return;
    dialog.querySelector("#lb-chess-tutorial-close").addEventListener("click", () => dialog.close());
    dialog.querySelector("#lb-chess-tutorial-gotit").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  // ---------------- Tablero / partida en curso ----------------
  function openGame(game) {
    const me = bridgePlayerId();
    const isWhite = game.white_player_id === me;
    const isBlack = game.black_player_id === me;
    if (!isWhite && !isBlack) return;

    closeRealtime();
    current = {
      gameId: game.id,
      mode: game.mode,
      difficulty: game.bot_difficulty,
      status: game.status,
      fen: game.fen || START_FEN,
      winner: game.winner || null,
      finished: game.status === "finished",
      myColor: isWhite ? "white" : "black",
      chess: new Chess(game.fen || START_FEN),
      lastFrom: null,
      lastTo: null,
    };
    try {
      localStorage.setItem("tierly-chess-last", JSON.stringify({ id: game.id, mode: game.mode }));
    } catch {
      // Storage disponible solo localmente.
    }
    if (current.mode === "pvp") subscribeRealtime(game.id);

    renderGame();
    if (current.mode === "bot" && current.chess.turn() === "b" && !current.finished) {
      botTurn();
    }
  }

  function closeRealtime() {
    if (realtimeChannel) {
      try { realtimeChannel.unsubscribe(); } catch { /* ya cerrado */ }
      realtimeChannel = null;
    }
  }

  function subscribeRealtime(gameId) {
    const myId = bridgePlayerId();
    const b = bridge();
    if (!b?.supabase) return;
    realtimeChannel = b.supabase.channel(`chess:${gameId}`, { config: { broadcast: { self: false } } });
    realtimeChannel
      .on("broadcast", { event: "move" }, (payload) => {
        if (!current || current.gameId !== gameId) return;
        if (payload?.fen && payload.fen !== current.chess.fen()) {
          const winner = payload.winner || null;
          applyServerPosition(payload.fen, winner, Boolean(winner));
        }
      })
      .on("broadcast", { event: "status" }, (payload) => {
        if (!current || current.gameId !== gameId) return;
        if (payload?.status === "declined") { closeRealtime(); current = null; renderLobby(); return; }
        reloadGameState(gameId);
      })
      .subscribe();
    void myId;
  }

  async function reloadGameState(gameId) {
    const result = await invoke({ action: "state", id: gameId });
    if (result.data?.game) openGame(result.data.game);
  }

  function isMyTurn() {
    if (!current || current.finished) return false;
    return current.chess.turn() === (current.myColor === "white" ? "w" : "b");
  }

  function isEngineTurn() {
    return current?.mode === "bot" && current.chess.turn() === "b" && !current.finished;
  }

  function destsFor(chess) {
    const dests = new Map();
    for (const move of chess.moves({ verbose: true })) {
      const list = dests.get(move.from);
      if (list) list.push(move.to);
      else dests.set(move.from, [move.to]);
    }
    return dests;
  }

  function renderGame() {
    const el = container();
    if (!el) return;
    const finished = current.finished;
    el.innerHTML = `
      <div class="lb-chess-layout">
        <div class="lb-chess-board-wrap"><div class="cg-wrap" id="lb-chess-board"></div></div>
        <div class="lb-chess-panel">
          <p class="lb-chess-status" id="lb-chess-status"></p>
          <div class="lb-chess-coach" id="lb-chess-coach">
            <img src="/tierly/streak/negro.png" alt="" class="lb-chess-coach-cat lb-chess-coach-cat-img" id="lb-chess-coach-cat" />
            <div class="lb-chess-coach-body">
              <strong>${t("chessCoachTitle")}</strong>
              <p id="lb-chess-coach-text"></p>
            </div>
          </div>
          ${finished
            ? `<p class="lb-chess-finished">${t("chessFinished")} · <strong>${t(current.winner === "draw" ? "chessDraw" : (current.winner === current.myColor ? "chessYouWin" : "chessYouLose"))}</strong></p>`
            : `<button type="button" id="lb-chess-resign" class="lb-chess-btn lb-chess-btn-danger">${t("chessResign")}</button>`}
          <button type="button" id="lb-chess-back" class="lb-chess-btn">← ${t("lbBack")}</button>
        </div>
      </div>`;
    el.querySelector("#lb-chess-back").addEventListener("click", () => {
      closeRealtime();
      current = null;
      renderLobby();
    });
    if (!finished) {
      el.querySelector("#lb-chess-resign").addEventListener("click", () => resignGame());
    }

    const wrap = el.querySelector("#lb-chess-board");
    board = Chessground(wrap, {
      fen: current.chess.fen(),
      orientation: current.myColor,
      turnColor: current.chess.turn() === "w" ? "white" : "black",
      animation: { enabled: true },
      draggable: { showGhost: true, enabled: true },
      movable: { free: false, showDests: true, color: null, dests: {}, promotion: false, rookCastle: true },
      highlight: { lastMove: true, check: true },
      events: { move: onUserMove },
    });
    syncBoard();
  }

  function syncBoard() {
    if (!board || !current) return;
    const movable = isMyTurn() && !isEngineTurn()
      ? { color: current.myColor, dests: destsFor(current.chess) }
      : { color: null, dests: {} };
    board.set({
      fen: current.chess.fen(),
      turnColor: current.chess.turn() === "w" ? "white" : "black",
      movable: { free: false, showDests: true, promotion: false, rookCastle: true, ...movable },
      lastMove: [current.lastFrom, current.lastTo].filter(Boolean),
    });

    if (current.finished) {
      setStatus(t(current.winner === "draw" ? "chessDraw" : (current.winner === current.myColor ? "chessYouWin" : "chessYouLose")));
    } else if (isEngineTurn()) {
      setStatus(`${t("chessBot")}…`);
    } else if (isMyTurn()) {
      setStatus(t("chessTurn"));
    } else if (current.mode === "pvp" && current.status === "pending") {
      setStatus(t("chessWaitingOpponent"));
    } else {
      setStatus(t("chessWaitingOpponent"));
    }
    renderCoachTip();
  }

  const V = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

  function pieceCount(chess) {
    let n = 0;
    for (const { type } of chess.board().flat().filter(Boolean)) n += (V[type] || 0);
    return n;
  }

  function myPieces(chess) {
    const color = chess.turn() === "w" ? "w" : "b";
    return chess.board().flat().filter((p) => p && p.color === color);
  }

  function coachTipKey(chess) {
    if (chess.isCheck()) return "chessCoachCheck";
    const total = pieceCount(chess);
    if (total <= 16) return "chessCoachEnd";
    if (chess.moveNumber() <= 6) return "chessCoachOpening";
    const minors = myPieces(chess).filter((p) => ["b", "n"].includes(p.type)).length;
    if (minors === 0 && total < 34) return "chessCoachPromote";
    if (chess.moveNumber() <= 11) return "chessCoachDevelop";
    if (minors < 2) return "chessCoachKing";
    const myQueens = myPieces(chess).filter((p) => p.type === "q").length;
    const enemyQueens = chess.board().flat().filter((p) => p && p.color !== chess.turn() && p.type === "q").length;
    if (myQueens === enemyQueens && myQueens < 2) return "chessCoachMaterial";
    return "chessCoachMiddle";
  }

  const COACH_CAT = {
    chessCoachCheck: "/tierly/streak/dorado.png",
    chessCoachEnd: "/tierly/streak/tuxedo.png",
    chessCoachPromote: "/tierly/streak/tuxedo.png",
    chessCoachOpening: "/tierly/streak/negro.png",
    chessCoachDevelop: "/tierly/streak/negro.png",
    chessCoachCenter: "/tierly/streak/naranjo.png",
    chessCoachMiddle: "/tierly/streak/naranjo.png",
    chessCoachMaterial: "/tierly/streak/naranjo.png",
    chessCoachKing: "/tierly/streak/naranjo.png",
  };

  function renderCoachTip() {
    const el = document.querySelector("#lb-chess-coach-text");
    if (!el || !current) return;
    const key = coachTipKey(current.chess);
    const tip = t(key);
    if (el.textContent !== tip) {
      el.textContent = tip;
      const cat = document.querySelector("#lb-chess-coach-cat");
      if (cat) {
        cat.classList.remove("pop");
        void cat.offsetWidth;
        cat.classList.add("pop");
      }
    }
    const cat = document.querySelector("#lb-chess-coach-cat");
    if (cat) cat.src = COACH_CAT[key] || COACH_CAT.chessCoachOpening;
    const coach = document.querySelector("#lb-chess-coach");
    if (coach) coach.classList.toggle("is-my-turn", isMyTurn() && !current.finished);
  }

  function applyServerPosition(fen, winner, gameOver) {
    if (!current) return;
    try {
      current.chess = new Chess(fen);
    } catch {
      return;
    }
    current.fen = fen;
    if (winner) current.winner = winner;
    if (gameOver) current.finished = true;
    syncBoard();
  }

  async function onUserMove(from, to) {
    if (!current || current.finished || !isMyTurn() || !bridgePlayerId()) return;
    const result = await invoke({ action: "move", id: current.gameId, from, to });
    if (result.error) { setStatus(result.error); syncBoard(); return; }
    current.lastFrom = from;
    current.lastTo = to;
    applyServerPosition(result.data.fen, result.data.winner, result.data.gameOver);
    if (!result.data.gameOver && isEngineTurn()) await botTurn();
  }

  async function resignGame() {
    if (!current || current.finished) return;
    const result = await invoke({ action: "resign", id: current.gameId });
    if (result.error) { setStatus(result.error); return; }
    current.winner = result.data.winner;
    current.finished = true;
    syncBoard();
  }

  // ---------------- Stockfish (bot) con fallback a jugada legal aleatoria ----
  function spawnEngine() {
    try {
      return new Worker(VENDOR_ENGINE_JS);
    } catch (error) {
      console.error("[CHESS] no se pudo crear el worker de Stockfish", error);
      return null;
    }
  }

  function randomLegalMove(chess) {
    const legal = chess.moves({ verbose: true }).filter((m) => m.color !== "w");
    if (!legal.length) return null;
    return legal[Math.floor(Math.random() * legal.length)];
  }

  function computeBotMove(fen) {
    const difficulty = DIFFICULTY_MAP[current?.difficulty] || DIFFICULTY_MAP.medium;
    const chess = new Chess(fen);
    const legal = chess.moves({ verbose: true }).filter((m) => m.color !== "w");
    if (!legal.length) return Promise.resolve(null);
    const fallback = () => legal[Math.floor(Math.random() * legal.length)];

    const engine = spawnEngine();
    if (!engine) return Promise.resolve(fallback());

    return new Promise((resolve) => {
      let settled = false;
      const finish = (move) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { engine.terminate(); } catch { /* worker ya muerto */ }
        resolve(move);
      };
      const timer = setTimeout(() => finish(fallback()), difficulty.movetime + 1500);
      engine.onmessage = (event) => {
        const text = String(event?.data ?? "");
        if (/^uciok/.test(text)) {
          engine.postMessage(`setoption name Skill Level value ${difficulty.skill}`);
          engine.postMessage("setoption name UCI_LimitStrength value true");
          engine.postMessage(`position fen ${fen}`);
          engine.postMessage(`go movetime ${difficulty.movetime}`);
          return;
        }
        if (/^bestmove\s+[a-h][1-8][a-h][1-8]/.test(text)) {
          const parts = text.trim().split(/\s+/);
          const from = parts[1].slice(0, 2);
          const to = parts[1].slice(2, 4);
          const promotion = parts[1].slice(4) || undefined;
          const match = legal.find((m) => m.from === from && m.to === to);
          finish(match ? { from, to, promotion: promotion || match.promotion } : fallback());
        }
      };
      engine.postMessage("uci");
    });
  }

  async function botTurn() {
    if (!current || !isEngineTurn()) return;
    const fen = current.chess.fen();
    setStatus(`${t("chessBot")}…`);
    const move = await computeBotMove(fen);
    if (!current || current.finished || !isEngineTurn()) return;
    const result = await invoke({ action: "move", id: current.gameId, from: move.from, to: move.to, promotion: move.promotion });
    if (result.error) { setStatus(result.error); return; }
    applyServerPosition(result.data.fen, result.data.winner, result.data.gameOver);
  }

  // ---------------- Vista principal / ciclo de vida ----------------
  function renderChessView() {
    const b = bridge();
    if (!b?.session?.()) {
      if (container()) container().innerHTML = `<p class="lb-chess-empty">${esc(t("chessLogin"))}</p>`;
      if (titleEl()) titleEl().textContent = t("navChess");
      return;
    }
    if (!b?.player?.()) {
      if (container()) container().innerHTML = `<p class="lb-chess-empty">${esc(t("chessSyncError"))}</p>`;
      if (titleEl()) titleEl().textContent = t("navChess");
      return;
    }
    if (titleEl()) titleEl().textContent = t("navChess");
    if (current?.gameId && !section?.hidden) {
      renderGame();
      return;
    }
    renderLobby();
    maybeResume();
  }

  async function maybeResume() {
    if (current?.gameId || !bridgePlayerId() || section?.hidden) return;
    let last = null;
    try { last = JSON.parse(localStorage.getItem("tierly-chess-last") || "null"); } catch { last = null; }
    if (!last?.id) return;
    const result = await invoke({ action: "state", id: last.id });
    if (!result.error && result.data?.game && ["pending", "active"].includes(result.data.game.status)) {
      openGame(result.data.game);
    } else {
      try { localStorage.removeItem("tierly-chess-last"); } catch { /* sin storage */ }
    }
  }

  function init() {
    window.addEventListener("DOMContentLoaded", () => {
      console.log("[CHESS] módulo de ajedrez inicializado");
    });
    wireTutorialDialog();
    if (!section) return;
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (!section.hidden) {
          renderChessView();
          return;
        }
      }
    });
    observer.observe(section, { attributes: true, attributeFilter: ["hidden"] });
  }

  init();
})();