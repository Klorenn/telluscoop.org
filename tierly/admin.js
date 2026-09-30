// Panel de insights de Tierly. Los agregados se protegen con RLS.
(() => {
  "use strict";

  const bridge = window.TierlyBridge;
  const root = document.querySelector("#tierly-admin");
  if (!bridge || !root) return;
  root.closest(".lb-view")?.setAttribute("data-view", "admin");
  const supabase = bridge.supabase;
  const state = { view: "games", communities: [], games: [], rollups: [], suggestions: [], players: [], authorized: false, message: "" };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const number = (value) => new Intl.NumberFormat("es-CL").format(Number(value || 0));
  const gameIconNames = ["gamepad-2", "trophy", "puzzle", "target", "zap", "rocket", "dice-5", "swords"];

  function gameIcon(game) {
    const text = `${game?.canonical_name || ""} ${game?.display_name || ""}`.toLowerCase();
    const match = [
      [/chess|ajedrez/, "crown"],
      [/racer|race|carrera/, "flag"],
      [/card|carta|poker/, "layers"],
      [/word|palabra/, "type"],
      [/quiz|trivia/, "circle-help"],
      [/puzzle/, "puzzle"],
      [/sport|futbol|football/, "medal"],
    ].find(([pattern]) => pattern.test(text));
    if (match) return match[1];
    const hash = [...text].reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 0);
    return gameIconNames[hash % gameIconNames.length];
  }

  function gameById(id) {
    return state.games.find((game) => String(game.id) === String(id)) || { display_name: `Juego ${id}`, canonical_name: String(id) };
  }

  function gameIconMarkup(id) {
    const game = gameById(id);
    return `<span class="tierly-admin-game-icon" aria-hidden="true"><i data-lucide="${gameIcon(game)}"></i></span>`;
  }

  function query(table) {
    return supabase.from(table).select("*");
  }

  function showLogin() {
    root.innerHTML = `<div class="tierly-admin-gate"><h2>Administración de insights</h2><p>Inicia sesión con Discord para comprobar el acceso de administrador.</p><button type="button" class="lb-discord-btn" id="tierly-admin-login">Iniciar sesión con Discord</button></div>`;
    root.querySelector("#tierly-admin-login").addEventListener("click", () => supabase.auth.signInWithOAuth({ provider: "discord", options: { redirectTo: `${window.location.origin}/tierly?admin=1` } }));
  }

  function renderTable(headers, rows) {
    if (!rows.length) return `<p class="lb-empty">No hay datos disponibles.</p>`;
    return `<div class="tierly-admin-table-wrap"><table class="tierly-admin-table"><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
  }

  function gameName(id) {
    return state.games.find((game) => String(game.id) === String(id))?.display_name || `Juego ${id}`;
  }

  function renderContent() {
    const view = state.view;
    let title = "Juegos";
    let body = "";
    if (view === "games") {
      const totals = new Map();
      state.rollups.forEach((row) => {
        const item = totals.get(row.game_id) || { players: 0, minutes: 0, sessions: 0 };
        item.players += Number(row.unique_players || 0);
        item.minutes += Number(row.total_minutes || 0);
        item.sessions += Number(row.session_count || 0);
        totals.set(row.game_id, item);
      });
       body = renderTable(["Juego", "Días agregados", "Jugadores", "Minutos", "Sesiones", "Quiénes jugaron"], [...totals.entries()].map(([id, total]) => {
         const players = state.players.filter((player) => String(player.game_id) === String(id));
         const names = players.map((player) => `<span class="tierly-admin-player">${player.avatar_url ? `<img src="${esc(player.avatar_url)}" alt="" loading="lazy">` : ""}<span>${esc(player.display_name || "Jugador sin nombre")}</span></span>`).join("");
         return `<tr><td><span class="tierly-admin-game-name">${gameIconMarkup(id)}<span>${esc(gameName(id))}</span></span></td><td>${number(state.rollups.filter((row) => String(row.game_id) === String(id)).length)}</td><td>${number(total.players)}</td><td>${number(total.minutes)}</td><td>${number(total.sessions)}</td><td><div class="tierly-admin-player-list">${names || "-"}</div></td></tr>`;
       }));
    } else if (view === "players") {
      title = "Jugadores";
       const total = state.players.length;
       body = `<div class="tierly-admin-stat"><strong>${number(total)}</strong><span>jugadores observados</span></div>${renderTable(["Juego", "Jugadores"], state.games.map((game) => { const players = state.players.filter((player) => String(player.game_id) === String(game.id)); return players.length ? `<tr><td>${esc(game.display_name)}</td><td><div class="tierly-admin-player-list">${players.map((player) => `<span class="tierly-admin-player">${player.avatar_url ? `<img src="${esc(player.avatar_url)}" alt="" loading="lazy">` : ""}<span>${esc(player.display_name || "Jugador sin nombre")}</span></span>`).join("")}</div></td></tr>` : ""; }).filter(Boolean))}`;
    } else if (view === "trends") {
      title = "Tendencias";
      const days = [...new Set(state.rollups.map((row) => row.day))].sort().reverse().slice(0, 14);
      body = renderTable(["Día", "Jugadores", "Minutos", "Sesiones"], days.map((day) => {
        const rows = state.rollups.filter((row) => row.day === day);
        return `<tr><td>${esc(day)}</td><td>${number(rows.reduce((sum, row) => sum + Number(row.unique_players || 0), 0))}</td><td>${number(rows.reduce((sum, row) => sum + Number(row.total_minutes || 0), 0))}</td><td>${number(rows.reduce((sum, row) => sum + Number(row.session_count || 0), 0))}</td></tr>`;
      }));
      body += `<p class="tierly-admin-note">Presence tiene cobertura parcial: esta vista solo representa los rollups diarios disponibles.</p>`;
    } else {
      title = "Sugerencias";
      body = renderTable(["Juego", "Jugadores", "Ventana", "Estado", "Acción"], state.suggestions.map((suggestion) => `<tr><td><span class="tierly-admin-game-name">${gameIconMarkup(suggestion.game_id)}<span>${esc(gameName(suggestion.game_id))}</span></span></td><td>${number(suggestion.player_count)}</td><td>${number(suggestion.window_days)} días</td><td>${esc(suggestion.status)}</td><td>${suggestion.status === "pending" ? `<button class="tierly-admin-action" data-suggestion-id="${esc(suggestion.id)}" data-status="accepted">Aceptar</button><button class="tierly-admin-action" data-suggestion-id="${esc(suggestion.id)}" data-status="dismissed">Descartar</button>` : "-"}</td></tr>`));
    }
    root.querySelector("#tierly-admin-content").innerHTML = `<h2>${title}</h2>${body}`;
    if (window.lucide?.createIcons) window.lucide.createIcons();
    root.querySelectorAll(".tierly-admin-action").forEach((button) => button.addEventListener("click", () => updateSuggestion(button)));
  }

  function render() {
    if (!state.authorized) return state.message ? (root.innerHTML = `<div class="tierly-admin-gate"><h2>Acceso no autorizado</h2><p>${esc(state.message)}</p></div>`) : showLogin();
    root.innerHTML = `<div class="tierly-admin-head"><div><p class="tierly-admin-kicker">Tierly insights</p><h1>Administración</h1><p class="tierly-admin-note">Datos agregados por comunidad, protegidos por RLS.</p></div><button type="button" class="lb-mini-btn" id="tierly-admin-refresh">Actualizar</button></div><nav class="tierly-admin-tabs" aria-label="Vistas de administración">${["games", "players", "trends", "suggestions"].map((view) => `<button type="button" data-admin-view="${view}" class="${state.view === view ? "is-active" : ""}">${view === "games" ? "Juegos" : view === "players" ? "Jugadores" : view === "trends" ? "Tendencias" : "Sugerencias"}</button>`).join("")}</nav><div id="tierly-admin-content"></div>`;
    root.querySelectorAll("[data-admin-view]").forEach((button) => button.addEventListener("click", () => { state.view = button.dataset.adminView; render(); }));
    root.querySelector("#tierly-admin-refresh").addEventListener("click", load);
    renderContent();
  }

  async function updateSuggestion(button) {
    button.disabled = true;
    const { error } = await supabase.rpc("tierly_update_suggestion_status", { p_suggestion_id: button.dataset.suggestionId, p_status: button.dataset.status });
    if (error) { state.message = error.message || "No se pudo actualizar la sugerencia."; }
    await load();
  }

  async function load() {
    render();
    if (!state.authorized) return;
    const adminResult = await supabase.from("community_admins").select("guild_id, role");
    const guildIds = (adminResult.data || []).map((row) => row.guild_id).filter(Boolean);
    if (adminResult.error || !guildIds.length) {
      state.authorized = false;
      state.message = "La cuenta autenticada no tiene una comunidad administrable.";
      return render();
    }
    const [communities, games, rollups, suggestions, players] = await Promise.all([
      supabase.from("communities").select("guild_id, name, presence_enabled").in("guild_id", guildIds),
      supabase.from("games").select("id, display_name, canonical_name"),
      supabase.from("daily_game_rollups").select("guild_id, game_id, day, unique_players, total_minutes, session_count").in("guild_id", guildIds),
      supabase.from("suggested_events").select("id, guild_id, game_id, generated_at, window_days, player_count, status").in("guild_id", guildIds),
      supabase.from("tierly_admin_game_players").select("guild_id, game_id, display_name, avatar_url").in("guild_id", guildIds),
    ]);
    state.communities = communities.data || [];
    state.games = games.data || [];
    state.rollups = rollups.data || [];
    state.suggestions = suggestions.data || [];
    state.players = players.data || [];
    state.message = [communities, games, rollups, suggestions, players].find((result) => result.error)?.error?.message || "";
    render();
  }

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    state.authorized = Boolean(session);
    if (!session) return render();
    await load();
    supabase.auth.onAuthStateChange((event, nextSession) => { state.authorized = Boolean(nextSession); state.message = ""; load(); });
  }

  window.TierlyAdmin = { open: () => load() };
  init().then(() => {
    if (location.pathname.replace(/\/$/, "") === "/tierly/admin" || new URLSearchParams(location.search).has("admin")) bridge.switchView("admin");
  });
})();
