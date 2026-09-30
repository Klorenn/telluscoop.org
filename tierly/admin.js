// Panel de insights de Tierly. Los agregados se protegen con RLS.
(() => {
  "use strict";

  const bridge = window.TierlyBridge;
  const root = document.querySelector("#tierly-admin");
  if (!bridge || !root) return;
  root.closest(".lb-view")?.setAttribute("data-view", "admin");
  const supabase = bridge.supabase;
  const state = { view: "games", communities: [], games: [], rollups: [], suggestions: [], authorized: false, message: "" };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const number = (value) => new Intl.NumberFormat("es-CL").format(Number(value || 0));

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
      body = renderTable(["Juego", "Días agregados", "Jugadores", "Minutos", "Sesiones"], [...totals.entries()].map(([id, total]) => `<tr><td>${esc(gameName(id))}</td><td>${number(state.rollups.filter((row) => String(row.game_id) === String(id)).length)}</td><td>${number(total.players)}</td><td>${number(total.minutes)}</td><td>${number(total.sessions)}</td></tr>`));
    } else if (view === "players") {
      title = "Jugadores";
      const total = state.rollups.reduce((sum, row) => sum + Number(row.unique_players || 0), 0);
      body = `<div class="tierly-admin-stat"><strong>${number(total)}</strong><span>participaciones únicas agregadas</span></div><p class="tierly-admin-note">Los jugadores se muestran como métricas agregadas. No se exponen identidades individuales.</p>`;
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
      body = renderTable(["Juego", "Jugadores", "Ventana", "Estado", "Acción"], state.suggestions.map((suggestion) => `<tr><td>${esc(gameName(suggestion.game_id))}</td><td>${number(suggestion.player_count)}</td><td>${number(suggestion.window_days)} días</td><td>${esc(suggestion.status)}</td><td>${suggestion.status === "pending" ? `<button class="tierly-admin-action" data-suggestion-id="${esc(suggestion.id)}" data-status="accepted">Aceptar</button><button class="tierly-admin-action" data-suggestion-id="${esc(suggestion.id)}" data-status="dismissed">Descartar</button>` : "-"}</td></tr>`));
    }
    root.querySelector("#tierly-admin-content").innerHTML = `<h2>${title}</h2>${body}`;
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
    const [communities, games, rollups, suggestions] = await Promise.all([
      supabase.from("communities").select("guild_id, name, presence_enabled").in("guild_id", guildIds),
      supabase.from("games").select("id, display_name, canonical_name"),
      supabase.from("daily_game_rollups").select("guild_id, game_id, day, unique_players, total_minutes, session_count").in("guild_id", guildIds),
      supabase.from("suggested_events").select("id, guild_id, game_id, generated_at, window_days, player_count, status").in("guild_id", guildIds),
    ]);
    state.communities = communities.data || [];
    state.games = games.data || [];
    state.rollups = rollups.data || [];
    state.suggestions = suggestions.data || [];
    state.message = [communities, games, rollups, suggestions].find((result) => result.error)?.error?.message || "";
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
