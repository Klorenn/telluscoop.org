// Panel de insights de Tierly. Los agregados se protegen con RLS.
(() => {
  "use strict";

  const bridge = window.TierlyBridge;
  const root = document.querySelector("#tierly-admin");
  if (!bridge || !root) return;
  root.closest(".lb-view")?.setAttribute("data-view", "admin");
  const supabase = bridge.supabase;
  const state = { view: "events", communities: [], games: [], rollups: [], suggestions: [], players: [], events: [], attendance: [], ledger: [], player: null, session: null, authorized: false, isAdmin: false, loading: false, message: "" };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const number = (value) => new Intl.NumberFormat("es-CL").format(Number(value || 0));
  const timezones = ["America/Santiago", "America/Argentina/Buenos_Aires", "America/Bogota", "America/Mexico_City", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Madrid", "Asia/Tokyo", "UTC"];
  const validTimezone = (value) => { try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(); return Boolean(value); } catch { return false; } };
  const localDateTimeToUtc = (value, timezone) => {
    if (!value || !validTimezone(timezone)) return null;
    const [date, time] = value.split("T");
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    let utc = Date.UTC(year, month - 1, day, hour, minute);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(utc)).filter(({ type }) => type !== "literal").map(({ type, value: part }) => [type, Number(part)]));
      const displayed = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
      utc += Date.UTC(year, month - 1, day, hour, minute) - displayed;
    }
    return new Date(utc).toISOString();
  };
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
    if (view === "events") {
      title = "Eventos comunitarios";
      const communityTimezones = state.communities.map((community) => community.timezone).filter(validTimezone);
      const timezoneOptions = [...new Set([...communityTimezones, ...timezones])];
      body = `${state.isAdmin ? `<div class="tierly-admin-event-form"><h3>Crear evento</h3><form id="tierly-event-form"><label>Comunidad<select name="guild_id" required>${state.communities.map((community) => `<option value="${esc(community.guild_id)}" data-timezone="${esc(community.timezone)}">${esc(community.name)}</option>`).join("")}</select></label><label>Zona horaria<select name="timezone" required>${timezoneOptions.map((timezone) => `<option value="${esc(timezone)}">${esc(timezone)}</option>`).join("")}</select></label><label>Nombre<input name="name" required maxlength="160"></label><label>Fecha y hora local<input name="starts_at" type="datetime-local" required></label><label>Fin local<input name="ends_at" type="datetime-local"></label><label>Ubicación<input name="location" maxlength="200"></label><label>Enlace de evento<input name="luma_url" type="url"></label><label>Descripción<textarea name="description" maxlength="1000"></textarea></label><button class="tierly-admin-action" type="submit">Crear evento</button></form></div>` : ""}${state.events.length ? state.events.map((event) => eventCard(event)).join("") : `<p class="lb-empty">No hay eventos comunitarios todavía.</p>`}`;
    } else if (view === "games") {
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
      body = renderTable(["Juego", "Jugadores", "Ventana", "Estado", "Acción"], state.suggestions.map((suggestion) => `<tr><td><span class="tierly-admin-game-name">${gameIconMarkup(suggestion.game_id)}<span>${esc(gameName(suggestion.game_id))}</span></span></td><td>${number(suggestion.player_count)}</td><td>${number(suggestion.window_days)} días</td><td>${esc(suggestion.status)}</td><td>${suggestion.status === "pending" ? `<button class="tierly-admin-action" data-suggestion-id="${esc(suggestion.id)}" data-status="accepted">Aceptar y crear</button><button class="tierly-admin-action" data-suggestion-id="${esc(suggestion.id)}" data-status="dismissed">Descartar</button>` : "-"}</td></tr>`));
    }
    const xp = state.ledger.reduce((total, row) => total + Number(row.xp || 0), 0);
    const stamps = state.ledger.reduce((total, row) => total + Number(row.stamps || 0), 0);
    root.querySelector("#tierly-admin-content").innerHTML = `${state.message ? `<p class="tierly-admin-note" role="alert">${esc(state.message)}</p>` : ""}<div class="tierly-admin-stat" aria-label="Progreso confirmado"><strong>${number(xp)} XP</strong><span>${number(stamps)} stamps confirmados</span></div><h2>${title}</h2>${body}`;
    if (window.lucide?.createIcons) window.lucide.createIcons();
    root.querySelectorAll(".tierly-admin-action").forEach((button) => button.addEventListener("click", () => button.dataset.eventAction ? eventAction(button) : updateSuggestion(button)));
    root.querySelector("#tierly-event-form")?.addEventListener("submit", createEvent);
    const eventForm = root.querySelector("#tierly-event-form");
    eventForm?.querySelector('[name="guild_id"]')?.addEventListener("change", (change) => {
      const timezone = change.currentTarget.selectedOptions[0]?.dataset.timezone;
      if (validTimezone(timezone)) eventForm.querySelector('[name="timezone"]').value = timezone;
    });
    if (eventForm) eventForm.querySelector('[name="guild_id"]')?.dispatchEvent(new Event("change"));
    root.querySelectorAll("[data-event-action]").forEach((button) => button.addEventListener("click", () => eventAction(button)));
  }

  function eventCard(event) {
    const rows = state.attendance.filter((row) => String(row.event_id) === String(event.id));
    const attendeeList = rows.length ? rows.map((row) => `<li><span>${esc(row.player_name || "Participante")}</span><span class="tierly-admin-attendance-state">${row.confirmed_at ? "Confirmada" : row.checked_in_at ? "Check-in" : row.unregistered_at ? "Salió" : "Registrado"}</span>${state.isAdmin ? (!row.confirmed_at && row.checked_in_at ? `<button class="tierly-admin-action" data-event-action="confirm" data-event-id="${esc(event.id)}" data-player-id="${esc(row.player_id)}">Confirmar</button>` : "") : ""}</li>`).join("") : `<li class="lb-empty">No hay asistentes todavía.</li>`;
    const mine = rows.find((row) => row.is_current_user);
     const canLeave = mine && !mine.unregistered_at && !mine.checked_in_at && !mine.confirmed_at;
     const canRegister = !mine || Boolean(mine.unregistered_at && !mine.confirmed_at);
      const timezone = validTimezone(event.timezone) ? event.timezone : "UTC";
      return `<article class="tierly-admin-event-card"><div><p class="tierly-admin-kicker">${esc((state.communities.find((c) => c.guild_id === event.guild_id) || {}).name || "Comunidad")}</p><h3>${esc(event.name)}</h3><p class="tierly-admin-note">${esc(event.starts_at ? `${new Date(event.starts_at).toLocaleString("es-CL", { timeZone: timezone })} (${timezone})` : event.event_date || "Fecha pendiente")} · ${esc(event.location || "Sin ubicación")}</p>${event.description ? `<p>${esc(event.description)}</p>` : ""}</div><div class="tierly-admin-event-actions">${state.session ? `${canLeave || canRegister ? `<button class="tierly-admin-action" data-event-action="${canLeave ? "unregister" : "register"}" data-event-id="${esc(event.id)}">${canLeave ? "Salir" : "Registrarme"}</button>` : ""}${mine && !mine.unregistered_at && !mine.checked_in_at && !mine.confirmed_at ? `<button class="tierly-admin-action" data-event-action="checkin" data-event-id="${esc(event.id)}">Check-in</button>` : ""}` : ""}</div><details><summary>Asistentes (${number(rows.filter((row) => !row.unregistered_at).length)})</summary><ul>${attendeeList}</ul></details></article>`;
  }

  function render() {
    if (!state.authorized) return state.message ? (root.innerHTML = `<div class="tierly-admin-gate"><h2>Acceso no autorizado</h2><p>${esc(state.message)}</p></div>`) : showLogin();
    root.innerHTML = `<div class="tierly-admin-head"><div><p class="tierly-admin-kicker">Tierly insights</p><h1>Administración</h1><p class="tierly-admin-note">Datos agregados por comunidad, protegidos por RLS.</p></div><button type="button" class="lb-mini-btn" id="tierly-admin-refresh">Actualizar</button></div><nav class="tierly-admin-tabs" aria-label="Vistas de administración">${["events", "games", "players", "trends", "suggestions"].map((view) => `<button type="button" data-admin-view="${view}" class="${state.view === view ? "is-active" : ""}">${view === "events" ? "Eventos" : view === "games" ? "Juegos" : view === "players" ? "Jugadores" : view === "trends" ? "Tendencias" : "Sugerencias"}</button>`).join("")}</nav><div id="tierly-admin-content"></div>`;
    root.querySelectorAll("[data-admin-view]").forEach((button) => button.addEventListener("click", () => { state.view = button.dataset.adminView; render(); }));
    root.querySelector("#tierly-admin-refresh").addEventListener("click", load);
    renderContent();
  }

  async function updateSuggestion(button) {
    button.disabled = true;
    let error;
    if (button.dataset.status === "accepted") {
      const suggestion = state.suggestions.find((item) => String(item.id) === button.dataset.suggestionId);
      const timezone = state.communities.find((community) => community.guild_id === suggestion.guild_id)?.timezone;
      const result = await supabase.rpc("tierly_create_event", { p_guild_id: suggestion.guild_id, p_name: `Evento de ${gameName(suggestion.game_id)}`, p_event_date: new Date().toISOString().slice(0, 10), p_starts_at: null, p_ends_at: null, p_timezone: validTimezone(timezone) ? timezone : null, p_location: null, p_luma_url: null, p_description: `Sugerencia para ${gameName(suggestion.game_id)}` });
      error = result.error;
      if (!error) { const updated = await supabase.rpc("tierly_update_suggestion_status", { p_suggestion_id: button.dataset.suggestionId, p_status: "accepted" }); error = updated.error; }
    } else ({ error } = await supabase.rpc("tierly_update_suggestion_status", { p_suggestion_id: button.dataset.suggestionId, p_status: button.dataset.status }));
    if (error) { state.message = error.message || "No se pudo actualizar la sugerencia."; }
    await load();
  }

  async function createEvent(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    if (!validTimezone(values.timezone) || !values.name.trim() || !values.starts_at) { state.message = "La zona horaria, el nombre y la fecha de inicio son obligatorios."; renderContent(); return; }
    const startsAt = localDateTimeToUtc(values.starts_at, values.timezone);
    const endsAt = values.ends_at ? localDateTimeToUtc(values.ends_at, values.timezone) : null;
    if (!startsAt || (values.ends_at && (!endsAt || new Date(endsAt) < new Date(startsAt)))) { state.message = "El horario del evento no es válido."; renderContent(); return; }
    const result = await supabase.rpc("tierly_create_event", { p_guild_id: values.guild_id, p_name: values.name, p_event_date: values.starts_at.slice(0, 10), p_starts_at: startsAt, p_ends_at: endsAt, p_timezone: values.timezone, p_location: values.location || null, p_luma_url: values.luma_url || null, p_description: values.description || null });
    state.message = result.error?.message || "";
    await load();
  }

  async function eventAction(button) {
    button.disabled = true;
    const action = button.dataset.eventAction;
    const args = { p_event_id: button.dataset.eventId };
    if (action === "confirm") args.p_player_id = button.dataset.playerId;
    const rpc = { register: "tierly_register_event", unregister: "tierly_unregister_event", checkin: "tierly_check_in_event", confirm: "tierly_confirm_event_attendance" }[action];
    const result = await supabase.rpc(rpc, args);
    state.message = result.error?.message || (result.data === false ? "La acción no pudo completarse." : "");
    await load();
  }

  async function load() {
    if (state.loading) return;
    state.loading = true;
    render();
    if (!state.authorized) { state.loading = false; return; }
    const adminResult = await supabase.from("community_admins").select("guild_id, role");
    const guildIds = (adminResult.data || []).map((row) => row.guild_id).filter(Boolean);
    state.isAdmin = !adminResult.error && guildIds.length > 0;
    const events = await supabase.from("gaming_events").select("id, guild_id, name, event_date, starts_at, ends_at, timezone, location, luma_url, description, status").order("starts_at", { ascending: true });
    const eventIds = (events.data || []).map((row) => row.id);
    const [player, attendance] = await Promise.all([
      supabase.from("gaming_players").select("id, display_name, avatar_url").eq("auth_user_id", state.session.user.id).maybeSingle(),
      eventIds.length ? supabase.from("tierly_event_attendance").select("event_id, player_id, registered_at, unregistered_at, checked_in_at, confirmed_at").in("event_id", eventIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (player.error) state.message = "No se pudo cargar el perfil autenticado.";
    state.player = player.data || null;
    state.events = events.data || [];
    const ledger = state.player ? await supabase.from("tierly_xp_ledger").select("xp, stamps, event_id, created_at").eq("player_id", state.player.id) : { data: [], error: null };
    state.ledger = ledger.data || [];
    state.attendance = (attendance.data || []).map((row) => ({ ...row, is_current_user: Boolean(state.player && String(row.player_id) === String(state.player.id)) }));
    if (state.isAdmin) {
      const [communities, games, rollups, suggestions, players] = await Promise.all([
        supabase.from("communities").select("guild_id, name, timezone, presence_enabled").in("guild_id", guildIds),
        supabase.from("games").select("id, display_name, canonical_name"),
        supabase.from("daily_game_rollups").select("guild_id, game_id, day, unique_players, total_minutes, session_count").in("guild_id", guildIds),
        supabase.from("suggested_events").select("id, guild_id, game_id, generated_at, window_days, player_count, status").in("guild_id", guildIds),
        supabase.from("tierly_admin_game_players").select("guild_id, game_id, player_id, display_name, avatar_url").in("guild_id", guildIds),
      ]);
      state.communities = communities.data || []; state.games = games.data || []; state.rollups = rollups.data || []; state.suggestions = suggestions.data || []; state.players = players.data || [];
    }
    state.message = state.message || [events, attendance, ledger].find((result) => result.error)?.error?.message || "";
    state.loading = false;
    render();
  }

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    state.session = session;
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
