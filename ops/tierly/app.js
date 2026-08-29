// ops/tierly/app.js
(() => {
  "use strict";
  const cfg = window.TIERLY_OPS_CONFIG;
  const supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  const $app = document.querySelector("#app");
  const PREVIEW = new URLSearchParams(location.search).get("preview") === "1";

  const state = {
    session: null,
    membership: null,
    view: "events",
    events: [],
    tournaments: [],
    matches: [],
    rewards: [],
    activeEventId: null,
    activeTournamentId: null,
    lumaEvents: null,
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = (d) => d ? new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(new Date(d)) : "—";

  function notify(message, isError) {
    const el = document.createElement("div");
    el.className = `toast${isError ? " error" : ""}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  async function loadMembership() {
    const { data: { session } } = await supabase.auth.getSession();
    state.session = session;
    if (!session) return;
    const { data } = await supabase
      .from("organization_members")
      .select("role, organization_id")
      .eq("user_id", session.user.id)
      .maybeSingle();
    state.membership = data;
  }

  async function invokeEdge(name, body) {
    const invoke = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return supabase.functions.invoke(name, {
        body,
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
    };
    let result = await invoke();
    if (result.error?.context?.status === 401) {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError) result = await invoke();
    }
    return result;
  }

  async function loadLumaEvents() {
    const { data, error } = await invokeEdge("luma-events", { action: "list" });
    if (error || data?.error) return notify(data?.error || error?.message || "No se pudo leer Luma.", true);
    state.lumaEvents = data.events ?? [];
    render();
  }

  function useLumaEvent(id) {
    const ev = (state.lumaEvents ?? []).find((e) => e.id === id);
    if (!ev) return;
    const form = document.querySelector("#event-form");
    if (!form) return;
    form.querySelector('[name="name"]').value = ev.name ?? "";
    form.querySelector('[name="event_date"]').value = ev.start_at ? ev.start_at.slice(0, 10) : "";
    form.querySelector('[name="name"]').focus();
  }

  async function loadEvents() {
    const { data, error } = await supabase.from("gaming_events").select("*").order("event_date", { ascending: false });
    if (error) return notify(error.message, true);
    state.events = data ?? [];
  }

  async function createEvent(name, eventDate, location) {
    const { error } = await supabase.from("gaming_events").insert({
      organization_id: state.membership.organization_id,
      name,
      event_date: eventDate || null,
      location: location || null,
    });
    if (error) return notify(error.message, true);
    notify("Evento creado");
    await loadEvents();
    render();
  }

  async function loadTournaments(eventId) {
    const { data, error } = await supabase.from("gaming_tournaments").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
    if (error) return notify(error.message, true);
    state.tournaments = data ?? [];
  }

  async function createTournament(eventId, game, format) {
    const { error } = await supabase.from("gaming_tournaments").insert({ event_id: eventId, game, format });
    if (error) return notify(error.message, true);
    notify("Torneo creado");
    await loadTournaments(eventId);
    render();
  }

  async function loadMatches(tournamentId) {
    const { data, error } = await supabase
      .from("gaming_matches")
      .select("*, gaming_match_participants(*, gaming_players(display_name))")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true });
    if (error) return notify(error.message, true);
    state.matches = data ?? [];
  }

  async function createMatch(tournamentId, round) {
    const { error } = await supabase.from("gaming_matches").insert({ tournament_id: tournamentId, round: round || null });
    if (error) return notify(error.message, true);
    await loadMatches(tournamentId);
    render();
  }

  async function addParticipant(matchId, discordId, displayName, placement) {
    const { data: player, error: playerError } = await supabase
      .from("gaming_players")
      .upsert({ discord_id: discordId, display_name: displayName }, { onConflict: "discord_id" })
      .select("id, avatar_url")
      .single();
    if (playerError) return notify(playerError.message, true);
    const { error } = await supabase.from("gaming_match_participants").insert({ match_id: matchId, player_id: player.id, placement });
    if (error) return notify(error.message, true);
    notify("Jugador agregado");
    if (!player.avatar_url) invokeEdge("discord-verify", { action: "lookup_avatar", discord_id: discordId });
    await loadMatches(state.activeTournamentId);
    render();
  }

  async function confirmMatch(matchId) {
    if (!confirm("¿Confirmar esta partida? Esto actualiza el puntaje del leaderboard.")) return;
    const { error } = await supabase
      .from("gaming_matches")
      .update({ status: "confirmed", confirmed_by: state.session.user.id, confirmed_at: new Date().toISOString() })
      .eq("id", matchId);
    if (error) return notify(error.message, true);
    notify("Partida confirmada, puntaje actualizado");
    await loadMatches(state.activeTournamentId);
    render();
  }

  async function loadRewards(tournamentId) {
    const { data, error } = await supabase.from("gaming_rewards").select("*, gaming_players(display_name)").eq("tournament_id", tournamentId);
    if (error) return notify(error.message, true);
    state.rewards = data ?? [];
  }

  async function searchPlayers(query) {
    const term = String(query ?? "").replace(/[,()%_*"'\\]/g, "").replace(/\s+/g, " ").trim();
    if (term.length < 2) return [];
    const { data, error } = await supabase
      .from("gaming_players")
      .select("id, display_name, username, avatar_url")
      .or(`display_name.ilike.%${term}%,username.ilike.%${term}%`)
      .order("display_name", { ascending: true })
      .limit(10);
    if (error) return [];
    return data ?? [];
  }

  async function createReward(tournamentId, playerId, description) {
    if (!playerId) return notify("Buscá y seleccioná un jugador primero.", true);
    const { error } = await supabase.from("gaming_rewards").insert({
      tournament_id: tournamentId,
      player_id: playerId,
      description,
      created_by: state.session.user.id,
    });
    if (error) return notify(error.message, true);
    notify("Premio asignado");
    await loadRewards(tournamentId);
    render();
  }

  async function markRewardFulfilled(rewardId) {
    const { error } = await supabase.from("gaming_rewards").update({ fulfilled: true, fulfilled_at: new Date().toISOString() }).eq("id", rewardId);
    if (error) return notify(error.message, true);
    await loadRewards(state.activeTournamentId);
    render();
  }

  function renderLogin() {
    $app.innerHTML = `
      <form id="login-form" class="auth-card">
        <h1>Leaderboard — Admin</h1>
        <input name="email" type="email" placeholder="email" required />
        <input name="password" type="password" placeholder="contraseña" required />
        <button type="submit">Ingresar</button>
      </form>`;
    document.querySelector("#login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const { error } = await supabase.auth.signInWithPassword({ email: fd.get("email"), password: fd.get("password") });
      if (error) return notify(error.message, true);
      await loadMembership();
      await loadEvents();
      render();
    });
  }

  function renderPreview() {
    $app.innerHTML = `<p class="preview-badge">Vista previa — sin datos reales</p>`;
  }

  function render() {
    if (PREVIEW) return renderPreview();
    if (!state.session) return renderLogin();
    if (!state.membership || state.membership.role === "viewer") {
      $app.innerHTML = `<p class="denied">Tu cuenta no tiene permisos de edición sobre el leaderboard.</p>`;
      return;
    }
    $app.innerHTML = `
      <nav class="ops-nav">
        <button data-view="events">Eventos</button>
        <button data-view="tournaments">Torneos</button>
        <button data-view="matches">Partidas</button>
        <button data-view="rewards">Premios</button>
      </nav>
      <section id="view-body"></section>`;
    document.querySelectorAll("[data-view]").forEach((btn) => btn.addEventListener("click", () => { state.view = btn.dataset.view; render(); }));
    renderView();
  }

  function renderView() {
    const body = document.querySelector("#view-body");
    if (!body) return;

    if (state.view === "events") {
      body.innerHTML = `
        <button id="sync-luma" type="button">Sincronizar con Luma</button>
        ${state.lumaEvents === null ? "" : state.lumaEvents.length === 0
          ? `<p class="empty">Luma no devolvió eventos.</p>`
          : `<ul class="luma-list">${state.lumaEvents.map((ev) => `
              <li>
                ${esc(ev.name)} — ${fmtDate(ev.start_at)}
                <button class="use-luma" data-id="${esc(ev.id)}" type="button">Usar</button>
              </li>`).join("")}</ul>`}
        <form id="event-form">
          <input name="name" placeholder="Nombre del evento" required />
          <input name="event_date" type="date" />
          <input name="location" placeholder="Lugar" />
          <button type="submit">Crear evento</button>
        </form>
        <ul>${state.events.map((e) => `<li data-id="${e.id}">${esc(e.name)} — ${fmtDate(e.event_date)}</li>`).join("")}</ul>`;
      document.querySelector("#sync-luma").addEventListener("click", loadLumaEvents);
      body.querySelectorAll(".use-luma").forEach((btn) => btn.addEventListener("click", () => useLumaEvent(btn.dataset.id)));
      document.querySelector("#event-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        createEvent(fd.get("name"), fd.get("event_date"), fd.get("location"));
      });
      body.querySelectorAll("li[data-id]").forEach((li) => li.addEventListener("click", async () => {
        state.activeEventId = li.dataset.id;
        await loadTournaments(state.activeEventId);
        state.view = "tournaments";
        render();
      }));
    } else if (state.view === "tournaments") {
      body.innerHTML = `
        <form id="tournament-form">
          <input name="game" placeholder="Juego (ej. Mario Kart 8)" required />
          <select name="format"><option value="elimination">Eliminación</option><option value="heats">Heats</option></select>
          <button type="submit">Crear torneo</button>
        </form>
        <ul>${state.tournaments.map((t) => `<li data-id="${t.id}">${esc(t.game)} — ${t.format} — ${t.status}</li>`).join("")}</ul>`;
      document.querySelector("#tournament-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        createTournament(state.activeEventId, fd.get("game"), fd.get("format"));
      });
      body.querySelectorAll("li[data-id]").forEach((li) => li.addEventListener("click", async () => {
        state.activeTournamentId = li.dataset.id;
        await loadMatches(state.activeTournamentId);
        await loadRewards(state.activeTournamentId);
        state.view = "matches";
        render();
      }));
    } else if (state.view === "matches") {
      body.innerHTML = `
        <button id="new-match">+ Nueva partida</button>
        ${state.matches.map((m) => `
          <div class="match-card" data-id="${m.id}">
            <strong>Partida ${m.round ?? ""} — ${m.status}</strong>
            <ul>${(m.gaming_match_participants ?? []).map((p) => `<li>${esc(p.gaming_players?.display_name ?? p.player_id)} — puesto ${p.placement}</li>`).join("")}</ul>
            ${m.status !== "confirmed" ? `
            <form class="participant-form" data-match="${m.id}">
              <input name="discord_id" placeholder="Discord ID" required />
              <input name="display_name" placeholder="Nombre" />
              <input name="placement" type="number" min="1" placeholder="Puesto" required oninput="this.nextElementSibling.textContent = window.calculatePoints ? window.calculatePoints(Number(this.value)) + ' pts' : ''" />
              <output></output>
              <button type="submit">Agregar</button>
            </form>` : ""}
            ${m.status !== "confirmed" ? `<button class="confirm-match" data-id="${m.id}">Confirmar</button>` : "✅ confirmada"}
          </div>`).join("")}`;
      document.querySelector("#new-match").addEventListener("click", () => createMatch(state.activeTournamentId));
      body.querySelectorAll(".participant-form").forEach((form) => form.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        addParticipant(form.dataset.match, fd.get("discord_id"), fd.get("display_name"), Number(fd.get("placement")));
      }));
      body.querySelectorAll(".confirm-match").forEach((btn) => btn.addEventListener("click", () => confirmMatch(btn.dataset.id)));
    } else if (state.view === "rewards") {
      body.innerHTML = `
        <form id="reward-form">
          <div class="reward-player">
            <input name="player_query" placeholder="Buscar jugador por nombre o @username…" autocomplete="off" />
            <input type="hidden" name="player_id" />
            <div class="reward-player-results"></div>
          </div>
          <input name="description" placeholder="Premio (ej. Ledger Nano)" required />
          <button type="submit">Asignar premio</button>
        </form>
        <ul>${state.rewards.map((r) => `<li data-id="${r.id}">${esc(r.gaming_players?.display_name ?? r.player_id)} — ${esc(r.description)} — ${r.fulfilled ? "entregado" : `<button class="fulfill" data-id="${r.id}">Marcar entregado</button>`}</li>`).join("")}</ul>`;
      const resultsEl = body.querySelector(".reward-player-results");
      let queryToken = 0;
      body.querySelector('[name="player_query"]').addEventListener("input", (e) => {
        const token = ++queryToken;
        const term = e.target.value;
        body.querySelector('[name="player_id"]').value = "";
        searchPlayers(term).then((players) => {
          if (token !== queryToken) return;
          if (!players.length) {
            resultsEl.innerHTML = term.trim().length >= 2
              ? `<p class="reward-player-empty">Sin coincidencias.</p>`
              : "";
            return;
          }
          resultsEl.innerHTML = players.map((p) => `
            <button type="button" class="reward-player-option" data-id="${p.id}" data-name="${esc(p.display_name ?? p.username ?? p.id)}">
              ${esc(p.display_name ?? "")}${p.username ? ` <span class="reward-player-username">@${esc(p.username)}</span>` : ""}
            </button>`).join("");
          resultsEl.querySelectorAll(".reward-player-option").forEach((opt) => opt.addEventListener("click", () => {
            body.querySelector('[name="player_id"]').value = opt.dataset.id;
            body.querySelector('[name="player_query"]').value = opt.dataset.name;
            resultsEl.innerHTML = `<p class="reward-player-selected">${esc(opt.dataset.name)}</p>`;
          }));
        });
      });
      body.querySelector("#reward-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        createReward(state.activeTournamentId, fd.get("player_id"), fd.get("description"));
      });
      body.querySelectorAll(".fulfill").forEach((btn) => btn.addEventListener("click", () => markRewardFulfilled(btn.dataset.id)));
    }
  }

  (async function init() {
    await loadMembership();
    if (state.session) await loadEvents();
    render();
  })();
})();
