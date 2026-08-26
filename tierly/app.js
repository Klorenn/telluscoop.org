// tierly/app.js
(() => {
  "use strict";
  const SUPABASE_URL = "https://rhzanxzoqmbxptvxgnfj.supabase.co";
  const SUPABASE_KEY = "sb_publishable_oiVUNWzo3p3SXLdr8in3XQ_zbZJiNd7";
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const STRINGS = {
    en: {
      title: "Tierly Gaming Leaderboard",
      subtitle: "Compete in events. Climb the ranks. Earn epic rewards.",
      rank: "Rank", player: "Player", points: "Points",
      rankingTitle: "Top Players",
      bracketTitle: "Latest event", rewardsTitle: "Winners & rewards",
      navRanking: "Leaderboard", navBracket: "Events", navRewards: "Rewards", navProfile: "Profile", navSettings: "Settings",
      profileTitle: "Profile",
      profileAccountTitle: "Account",
      passportStatsTitle: "Stellar Passport stats",
      passportStatsEmpty: "Link your Stellar Passport profile to see your builder stats here.",
      passportStatsLoading: "Loading your builder profile…",
      passportStatsError: "Couldn't load your Stellar Passport stats right now.",
      passportStatCategory: "Category", passportStatStamps: "Stamps collected", passportStatWebsite: "Visit website ↗",
      top5: "Top 5", all: "All Players", viewFull: "View Full Leaderboard", searchPlaceholder: "Search player…",
      loginDiscord: "Sign in with Discord", loginedAs: "Signed in as",
      loginPrompt: "Sync your profile, check your history, and join events.",
      empty: "No results yet.",
      statPlayers: "Active players", statEvents: "Live events", statRewards: "Rewards claimed", statMatches: "Matches played",
      joinCompete: "Join and compete!",
      settingsTitle: "Settings",
      settingsLangLabel: "Language",
      settingsThemeLabel: "Theme", themeLight: "Light", themeDark: "Dark",
      settingsAbout: "Tierly is the Discord verification bot for this leaderboard — it only checks server membership, it never reads or posts messages.",
      eventLive: "LIVE", eventUpcoming: "UPCOMING", eventPast: "COMPLETED",
      promoTitle1: "Climb the ranks.", promoTitle2: "Become legendary.",
      promoBody: "Compete in events and earn exclusive rewards.", promoExplore: "Explore Events",
      promoSidebar: "Climb the ranks. Earn rewards.",
      latestEventLabel: "Latest Event", viewEvent: "View Event",
      topRewardLabel: "Top Reward", viewRewards: "View Rewards",
      verified: "Discord verified",
      emptyPlayersTitle: "No players on the ranking yet",
      emptyPlayersBody: "Join an event and become the first.",
      emptyEventTitle: "No events yet", emptyRewardTitle: "No rewards yet",
      upcomingEventsTitle: "Upcoming events", recentActivityTitle: "Recent activity",
      noUpcomingEvents: "No upcoming events yet.", noRecentActivity: "No recent activity yet.",
      activityReward: "received",
      passportPlaceholder: "Search your Stellar Passport handle…",
      passportLinkBtn: "Link",
      passportLinkError: "Couldn't link this profile. Check the handle and try again.",
      passportLinked: "Stellar Passport profile ↗",
      passportResultsLabel: "Also on Stellar Passport",
      passportNoMatches: "No matches found",
      discordJoinBody: "You must join the Tellus Discord server to participate — Tierly checks your membership before unlocking anything.",
      discordJoinBtn: "Join Tellus Discord",
      discordVerifyBtn: "I already joined · Verify",
      discordChecking: "Checking your membership…",
      discordVerifyError: "We couldn't check Discord right now. Try again in a moment.",
    },
    es: {
      title: "Leaderboard Gaming Tierly",
      subtitle: "Compite en eventos. Sube en el ranking. Gana premios.",
      rank: "Puesto", player: "Jugador", points: "Puntos",
      rankingTitle: "Mejores jugadores",
      bracketTitle: "Último evento", rewardsTitle: "Ganadores y premios",
      navRanking: "Leaderboard", navBracket: "Eventos", navRewards: "Premios", navProfile: "Perfil", navSettings: "Configuración",
      profileTitle: "Perfil",
      profileAccountTitle: "Cuenta",
      passportStatsTitle: "Estadísticas de Stellar Passport",
      passportStatsEmpty: "Vincula tu perfil de Stellar Passport para ver tus estadísticas de builder acá.",
      passportStatsLoading: "Cargando tu perfil de builder…",
      passportStatsError: "No pudimos cargar tus estadísticas de Stellar Passport ahora.",
      passportStatCategory: "Categoría", passportStatStamps: "Sellos conseguidos", passportStatWebsite: "Visitar sitio web ↗",
      top5: "Top 5", all: "Todos", viewFull: "Ver leaderboard completo", searchPlaceholder: "Buscar jugador…",
      loginDiscord: "Iniciar sesión con Discord", loginedAs: "Sesión iniciada como",
      loginPrompt: "Sincroniza tu perfil, revisa tu historial y participa en eventos.",
      empty: "Todavía no hay resultados.",
      statPlayers: "Jugadores activos", statEvents: "Eventos en vivo", statRewards: "Premios entregados", statMatches: "Partidas jugadas",
      joinCompete: "¡Únete!",
      settingsTitle: "Configuración",
      settingsLangLabel: "Idioma",
      settingsThemeLabel: "Tema", themeLight: "Claro", themeDark: "Oscuro",
      settingsAbout: "Tierly es el bot de verificación de Discord de este leaderboard — solo confirma tu membresía del server, nunca lee ni postea mensajes.",
      eventLive: "EN VIVO", eventUpcoming: "PRÓXIMO", eventPast: "FINALIZADO",
      promoTitle1: "Sube en el ranking.", promoTitle2: "Conviértete en leyenda.",
      promoBody: "Compite en eventos y gana premios exclusivos.", promoExplore: "Ver eventos",
      promoSidebar: "Sube en el ranking. Gana premios.",
      latestEventLabel: "Último evento", viewEvent: "Ver evento",
      topRewardLabel: "Premio destacado", viewRewards: "Ver premios",
      verified: "Verificado con Discord",
      emptyPlayersTitle: "Todavía no hay jugadores en el ranking",
      emptyPlayersBody: "Participa en un evento y conviértete en el primero.",
      emptyEventTitle: "Todavía no hay eventos", emptyRewardTitle: "Todavía no hay premios",
      upcomingEventsTitle: "Próximos eventos", recentActivityTitle: "Actividad reciente",
      noUpcomingEvents: "No hay próximos eventos todavía.", noRecentActivity: "Todavía no hay actividad reciente.",
      activityReward: "recibió",
      passportPlaceholder: "Buscá tu handle de Stellar Passport…",
      passportLinkBtn: "Vincular",
      passportLinkError: "No pudimos vincular este perfil. Revisá el handle e intentá de nuevo.",
      passportLinked: "Perfil de Stellar Passport ↗",
      passportResultsLabel: "También en Stellar Passport",
      passportNoMatches: "No encontramos coincidencias",
      discordJoinBody: "Debes unirte al servidor de Discord de Tellus para participar — Tierly comprueba tu membresía antes de desbloquear cualquier cosa.",
      discordJoinBtn: "Unirse al Discord de Tellus",
      discordVerifyBtn: "Ya me uní · Verificar",
      discordChecking: "Comprobando tu membresía…",
      discordVerifyError: "No pudimos comprobar Discord ahora. Probá de nuevo en un momento.",
    },
  };
  const DISCORD_ICON = `<svg viewBox="0 0 24 24"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8649-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3846-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.522 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>`;
  const CHECK_ICON = `<svg viewBox="0 0 20 20" fill="currentColor" class="lb-verified"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`;
  const DISCORD_INVITE_URL = "https://discord.gg/Fy2SgR3XRu";
  const SOCIAL_LINKS = [
    { href: DISCORD_INVITE_URL, label: "Discord", icon: DISCORD_ICON },
    { href: "https://x.com/TellusCoop", label: "X", icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>` },
    { href: "https://www.instagram.com/telluscoop/", label: "Instagram", icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>` },
    { href: "https://www.linkedin.com/company/tellus-cooperative/", label: "LinkedIn", icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>` },
    { href: "https://www.youtube.com/@telluscoop", label: "YouTube", icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>` },
    { href: "https://chat.whatsapp.com/FsNIUPsmNCl2YJkQi5r4p4", label: "WhatsApp", icon: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>` },
  ];
  let lang = (localStorage.getItem("tellus-lang") || "en").startsWith("es") ? "es" : "en";
  const t = (key) => STRINGS[lang][key] ?? key;
  let theme = localStorage.getItem("tellus-theme") === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", theme);
  let currentSession = null;
  let currentPassportUrl = null;
  let activeView = "ranking";
  let rankingLimit = 5;
  let rankingSearch = "";
  let rankingRows = [];
  let bracketRows = [];
  let rewardsRows = [];

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const initials = (name) => esc((name || "?").trim().slice(0, 2).toUpperCase());
  function resolveAvatarUrl(user) {
    const discordIdentity = user?.identities?.find((identity) => identity.provider === "discord");
    return user?.user_metadata?.avatar_url || user?.user_metadata?.picture || discordIdentity?.identity_data?.avatar_url || null;
  }

  function renderSessionAvatar(user) {
    const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "?";
    const fallback = `<span class="lb-session-avatar lb-session-avatar-fallback" aria-hidden="true">${initials(name)}</span>`;
    const avatarUrl = resolveAvatarUrl(user);
    if (!avatarUrl) return fallback;
    return `<img class="lb-session-avatar" src="${esc(avatarUrl)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'" /><span class="lb-session-avatar lb-session-avatar-fallback" aria-hidden="true" style="display:none">${initials(name)}</span>`;
  }

  function renderImageWithFallback(url, name, className = "lb-rank-avatar") {
    const fallback = `<span class="${className} lb-rank-avatar-fallback">${initials(name)}</span>`;
    if (!url) return fallback;
    return `<img src="${esc(url)}" alt="" class="${className}" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'" /><span class="${className} lb-rank-avatar-fallback" aria-hidden="true" style="display:none">${initials(name)}</span>`;
  }

  function formatPassportLinkError(error, data) {
    const status = Number(error?.context?.status || error?.status);
    if (status === 404 || /No encontramos/i.test(String(data?.error || ""))) return " (perfil no encontrado)";
    if (status === 429) return " (límite temporal, probá más tarde)";
    if (Number.isInteger(status) && status >= 400 && status < 600) return ` (${status})`;
    return "";
  }

  function formatDiscordVerifyError(error) {
    const status = Number(error?.context?.status || error?.status);
    if (Number.isInteger(status) && status >= 400 && status < 600) return ` (${status})`;
    return "";
  }

  function emptyStateBlock(title, body, ctaLabel, ctaView, mascot = "tierly-apoyado.png") {
    return `
      <div class="lb-empty-state">
        <img src="/tierly/${mascot}" alt="Tierly" class="lb-empty-mascot" />
        <strong>${title}</strong>
        <p>${body}</p>
        <button class="lb-promo-btn lb-empty-cta" data-view="${ctaView}">${ctaLabel}</button>
      </div>`;
  }

  function renderRankingRows() {
    const el = document.querySelector("#lb-ranking");
    if (!rankingRows.length) {
      el.innerHTML = emptyStateBlock(t("emptyPlayersTitle"), t("emptyPlayersBody"), `${t("promoExplore")} →`, "bracket", "tierly-ranking.png");
      el.querySelectorAll("[data-view]").forEach((btn) => btn.addEventListener("click", () => switchView(btn.dataset.view)));
      return;
    }
    const query = rankingSearch.trim().toLowerCase();
    const filtered = query
      ? rankingRows.filter((row) => (row.display_name || "").toLowerCase().includes(query))
      : rankingRows;
    if (!filtered.length) {
      el.innerHTML = `<p class="lb-empty">${t("empty")}</p>`;
      return;
    }
    const rows = query ? filtered : filtered.slice(0, rankingLimit);
    el.innerHTML = `
      <div class="lb-rank-list">
        <div class="lb-rank-head"><span>${t("rank")}</span><span>${t("player")}</span><span>${t("points")}</span></div>
        ${rows.map((row) => {
          const rank = rankingRows.indexOf(row) + 1;
          const tierClass = rank <= 3 ? ` tier-${rank}` : "";
          return `
          <div class="lb-rank-row${rank === 1 ? " lb-rank-row-first" : ""}">
            <span class="lb-rank-badge${tierClass}">${rank}</span>
            <span class="lb-rank-player">
              ${renderImageWithFallback(row.avatar_url, row.display_name)}
              <span class="lb-rank-name">${esc(row.display_name || "—")}${row.discord_member ? CHECK_ICON : ""}</span>
            </span>
            <span class="lb-rank-points">${row.total_points}</span>
          </div>`;
        }).join("")}
      </div>`;
  }

  async function loadRanking() {
    const { data, error } = await supabase
      .from("leaderboard_public_view")
      .select("*")
      .order("total_points", { ascending: false })
      .limit(50);
    rankingRows = error || !data ? [] : data;
    renderRankingRows();
  }

  function eventStatus(dateStr) {
    if (!dateStr) return null;
    const eventDay = new Date(`${dateStr}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (eventDay.getTime() === today.getTime()) return "live";
    return eventDay.getTime() > today.getTime() ? "upcoming" : "past";
  }

  function fmtEventDate(dateStr) {
    if (!dateStr) return "";
    return new Intl.DateTimeFormat(lang === "es" ? "es-CL" : "en-US", { dateStyle: "medium" }).format(new Date(`${dateStr}T00:00:00`));
  }

  function renderLatestBracket() {
    const el = document.querySelector("#lb-bracket");
    if (!bracketRows.length) { el.innerHTML = `<p class="lb-empty">${t("empty")}</p>`; return; }
    const latestEventId = bracketRows[0].event_id;
    const rows = bracketRows.filter((r) => r.event_id === latestEventId);
    const status = eventStatus(rows[0].event_date);
    const badgeLabel = status === "live" ? t("eventLive") : status === "upcoming" ? t("eventUpcoming") : t("eventPast");
    el.innerHTML = `
      <div class="lb-event-banner lb-event-${status || "past"}">
        ${status ? `<span class="lb-event-badge">${badgeLabel}</span>` : ""}
        <h3>${esc(rows[0].event_name)}</h3>
        <span class="lb-event-date">${esc(fmtEventDate(rows[0].event_date))}</span>
      </div>
      <ul>${rows.map((r) => `<li>${esc(r.game)} — ${esc(r.display_name || "—")} — ${r.match_status}${r.placement ? ` (#${r.placement})` : ""}</li>`).join("")}</ul>`;
  }

  async function loadLatestBracket() {
    const { data, error } = await supabase
      .from("event_bracket_public_view")
      .select("*")
      .order("event_date", { ascending: false })
      .limit(50);
    bracketRows = error || !data ? [] : data;
    renderLatestBracket();
  }

  async function loadRewards() {
    const { data, error } = await supabase
      .from("gaming_rewards_public_view")
      .select("*")
      .limit(30);
    rewardsRows = error || !data ? [] : data;
    const el = document.querySelector("#lb-rewards");
    if (!rewardsRows.length) { el.innerHTML = `<p class="lb-empty">${t("empty")}</p>`; return; }
    el.innerHTML = `<ul>${rewardsRows.map((r) => `<li>${esc(r.display_name || "—")} — ${esc(r.description)}</li>`).join("")}</ul>`;
  }

  function renderStats() {
    const el = document.querySelector("#lb-stats");
    if (!el) return;
    const liveEventCount = new Set(bracketRows.filter((r) => eventStatus(r.event_date) === "live").map((r) => r.event_id)).size;
    const matchesPlayed = new Set(bracketRows.filter((r) => r.match_status === "confirmed").map((r) => r.match_id)).size;
    el.innerHTML = `
      <div class="lb-stat-card">
        <span class="lb-stat-icon"><i data-lucide="users"></i></span>
        <div><span class="lb-stat-label">${t("statPlayers")}</span><strong>${rankingRows.length}</strong></div>
      </div>
      <div class="lb-stat-card lb-stat-accent">
        <span class="lb-stat-icon"><i data-lucide="calendar-days"></i></span>
        <div><span class="lb-stat-label">${t("statEvents")}</span><strong>${liveEventCount}</strong><a href="#" class="lb-stat-cta" data-view="bracket">${t("joinCompete")}</a></div>
      </div>
      <div class="lb-stat-card">
        <span class="lb-stat-icon"><i data-lucide="gift"></i></span>
        <div><span class="lb-stat-label">${t("statRewards")}</span><strong>${rewardsRows.length}</strong></div>
      </div>
      <div class="lb-stat-card lb-stat-accent">
        <span class="lb-stat-icon"><i data-lucide="gamepad-2"></i></span>
        <div><span class="lb-stat-label">${t("statMatches")}</span><strong>${matchesPlayed}</strong></div>
      </div>`;
    el.querySelectorAll("[data-view]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); switchView(a.dataset.view); }));
    window.lucide?.createIcons();
    renderSideCards();
    renderUpcomingEvents();
    renderRecentActivity();
  }

  function renderSideCards() {
    const el = document.querySelector("#lb-side");
    if (!el) return;
    const latestEvent = bracketRows[0];
    const latestReward = rewardsRows[0];
    el.innerHTML = `
      <div class="lb-promo-card">
        <img src="/tierly/tierly-trofeo.png" alt="Tierly" class="lb-promo-mascot" />
        <h3>${t("promoTitle1")}<br>${t("promoTitle2")}</h3>
        <p>${t("promoBody")}</p>
        <button class="lb-promo-btn" data-view="bracket">${t("promoExplore")} →</button>
      </div>
      <div class="lb-discord-card">
        <div class="lb-discord-icon">${DISCORD_ICON}</div>
        <div>
          <strong>${t("loginDiscord")}</strong>
          <p>${t("loginPrompt")}</p>
        </div>
        <button class="lb-mini-btn" data-view="profile">${t("navProfile")} →</button>
      </div>
      <div class="lb-mini-row">
      <div class="lb-mini-card">
        <div class="lb-mini-head"><span>${t("latestEventLabel")}</span>${latestEvent ? `<span class="lb-event-badge lb-mini-badge">${t(eventStatus(latestEvent.event_date) === "live" ? "eventLive" : eventStatus(latestEvent.event_date) === "upcoming" ? "eventUpcoming" : "eventPast")}</span>` : ""}</div>
        ${latestEvent
          ? `<strong>${esc(latestEvent.event_name)}</strong><span class="lb-mini-sub">${esc(fmtEventDate(latestEvent.event_date))}</span>`
          : `<i data-lucide="calendar" class="lb-mini-empty-icon"></i><span class="lb-mini-sub">${t("emptyEventTitle")}</span>`}
        <button class="lb-mini-btn" data-view="bracket">${t("viewEvent")} →</button>
      </div>
      <div class="lb-mini-card">
        <div class="lb-mini-head"><span>${t("topRewardLabel")}</span></div>
        ${latestReward
          ? `<strong>${esc(latestReward.description)}</strong><span class="lb-mini-sub">${esc(latestReward.display_name || "—")}</span>`
          : `<i data-lucide="gift" class="lb-mini-empty-icon"></i><span class="lb-mini-sub">${t("emptyRewardTitle")}</span>`}
        <button class="lb-mini-btn" data-view="rewards">${t("viewRewards")} →</button>
      </div>
      </div>`;
    el.querySelectorAll("[data-view]").forEach((btn) => btn.addEventListener("click", () => switchView(btn.dataset.view)));
    window.lucide?.createIcons();
  }

  function renderUpcomingEvents() {
    const el = document.querySelector("#lb-upcoming");
    if (!el) return;
    const byEvent = new Map();
    bracketRows.forEach((r) => { if (!byEvent.has(r.event_id)) byEvent.set(r.event_id, r); });
    const upcoming = Array.from(byEvent.values())
      .filter((r) => eventStatus(r.event_date) === "upcoming")
      .sort((a, b) => (a.event_date < b.event_date ? -1 : 1))
      .slice(0, 3);
    if (!upcoming.length) { el.innerHTML = `<p class="lb-empty">${t("noUpcomingEvents")}</p>`; return; }
    el.innerHTML = upcoming.map((r) => `
      <div class="lb-upcoming-row">
        <div>
          <strong>${esc(r.event_name)}</strong>
          <span class="lb-mini-sub">${esc(r.game)} · ${esc(fmtEventDate(r.event_date))}</span>
        </div>
        <button class="lb-mini-btn" data-view="bracket">${t("viewEvent")} →</button>
      </div>`).join("");
    el.querySelectorAll("[data-view]").forEach((btn) => btn.addEventListener("click", () => switchView(btn.dataset.view)));
  }

  function renderRecentActivity() {
    const el = document.querySelector("#lb-activity");
    if (!el) return;
    const fulfilled = rewardsRows
      .filter((r) => r.fulfilled && r.fulfilled_at)
      .sort((a, b) => (a.fulfilled_at < b.fulfilled_at ? 1 : -1))
      .slice(0, 5);
    if (!fulfilled.length) { el.innerHTML = `<p class="lb-empty">${t("noRecentActivity")}</p>`; return; }
    el.innerHTML = fulfilled.map((r) => `
      <div class="lb-activity-row">
        <i data-lucide="gift"></i>
        <span>${esc(r.display_name || "—")} ${t("activityReward")} <strong>${esc(r.description)}</strong></span>
      </div>`).join("");
    window.lucide?.createIcons();
  }

  function renderFooter() {
    const el = document.querySelector("#lb-footer-links");
    if (!el) return;
    el.innerHTML = SOCIAL_LINKS.map((s) => `<a href="${s.href}" target="_blank" rel="noopener noreferrer" aria-label="${s.label}" class="lb-footer-icon">${s.icon}</a>`).join("");
  }

  function renderPassportLink(url) {
    const el = document.querySelector("#lb-passport-link");
    if (!el) return;
    if (url) {
      el.innerHTML = `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="lb-passport-linked">${t("passportLinked")}</a>`;
      return;
    }
    el.innerHTML = `
      <form id="lb-passport-form" autocomplete="off">
        <div class="lb-passport-autocomplete">
          <input type="text" name="handle" placeholder="${t("passportPlaceholder")}" required />
          <div id="lb-passport-suggest" class="lb-passport-suggest" hidden></div>
        </div>
        <button type="submit" disabled>${t("passportLinkBtn")}</button>
        <p id="lb-passport-link-error" class="lb-passport-link-error" role="alert" hidden></p>
      </form>`;

    const form = document.querySelector("#lb-passport-form");
    const input = form.querySelector("input[name=handle]");
    const submitBtn = form.querySelector("button");
    const suggestEl = document.querySelector("#lb-passport-suggest");
    let selectedUrl = null;
    let suggestToken = 0;
    let debounceTimer = null;

    function renderSuggestions(builders) {
      if (!builders.length) {
        suggestEl.innerHTML = `<div class="lb-passport-suggest-empty">${t("passportNoMatches")}</div>`;
        suggestEl.hidden = false;
        return;
      }
      suggestEl.innerHTML = builders.map((b) => `
        <button type="button" class="lb-passport-suggest-row" data-username="${esc(b.username)}" data-name="${esc(b.name || b.username)}">
          ${renderImageWithFallback(b.logo_url, b.name, "lb-passport-suggest-avatar")}
          <span>
            <span class="lb-passport-suggest-name">${esc(b.name || b.username)}</span>
            <span class="lb-passport-suggest-username">@${esc(b.username)}</span>
          </span>
        </button>`).join("");
      suggestEl.hidden = false;
      suggestEl.querySelectorAll(".lb-passport-suggest-row").forEach((row) => {
        row.addEventListener("click", () => {
          selectedUrl = `https://demo.stellarpassport.xyz/builder/${encodeURIComponent(row.dataset.username)}`;
          input.value = row.dataset.name;
          suggestEl.hidden = true;
          submitBtn.disabled = false;
        });
      });
    }

    input.addEventListener("input", () => {
      selectedUrl = null;
      submitBtn.disabled = true;
      const query = input.value.trim();
      clearTimeout(debounceTimer);
      if (query.length < 2) {
        suggestEl.hidden = true;
        return;
      }
      debounceTimer = setTimeout(async () => {
        const token = ++suggestToken;
        if (!currentSession) return;
        try {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/passport-profile?action=builders&q=${encodeURIComponent(query)}`, {
            headers: { Authorization: `Bearer ${currentSession.access_token}` },
          });
          if (!res.ok || token !== suggestToken) return;
          const data = await res.json();
          if (token === suggestToken) renderSuggestions(data.builders || []);
        } catch {
          // Silent — suggestions are best-effort.
        }
      }, 300);
    });

    input.addEventListener("blur", () => {
      setTimeout(() => { suggestEl.hidden = true; }, 150);
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!selectedUrl || !currentSession) return;
      const { data, error } = await supabase.functions.invoke("discord-verify", {
        body: { stellar_passport_url: selectedUrl },
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });
      const errorEl = document.querySelector("#lb-passport-link-error");
      if (errorEl) errorEl.hidden = true;
      if (error || data?.error) {
        if (errorEl) {
          errorEl.textContent = `${t("passportLinkError")}${formatPassportLinkError(error, data)}`;
          errorEl.hidden = false;
        }
        return;
      }
      renderPassportLink(data?.stellar_passport_url || selectedUrl);
    });
  }

  async function checkDiscordMembership(session) {
    const gateEl = document.querySelector("#lb-discord-gate");
    if (!gateEl) return;
    gateEl.innerHTML = `<p class="lb-gate-checking">${t("discordChecking")}</p>`;
    const { data, error } = await supabase.functions.invoke("discord-verify", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (error || !data?.verified) {
      const errorMessage = error ? ` · ${t("discordVerifyError")}${formatDiscordVerifyError(error)}` : "";
      gateEl.innerHTML = `
        <div class="lb-gate-blocked">
          <span class="lb-not-verified">${errorMessage || t("discordJoinBody")}</span>
          <a href="${DISCORD_INVITE_URL}" target="_blank" rel="noopener noreferrer" class="lb-discord-btn">${t("discordJoinBtn")}</a>
          <button id="lb-retry-verify" class="lb-gate-retry">${t("discordVerifyBtn")}</button>
        </div>`;
      document.querySelector("#lb-retry-verify")?.addEventListener("click", () => checkDiscordMembership(session));
      return;
    }
    gateEl.innerHTML = `
      <span class="lb-verified-badge">✓ ${t("verified")}</span>
      <div id="lb-passport-link" class="lb-passport-block"></div>`;
    renderPassportLink(data?.stellar_passport_url);
    renderPassportStats(data?.stellar_passport_url);
  }

  function renderAuth(session) {
    currentSession = session;
    const el = document.querySelector("#lb-auth");
    if (!el) return;
    if (!session) {
      el.innerHTML = `<button id="lb-discord-login" class="lb-discord-btn">${t("loginDiscord")}</button>`;
      document.querySelector("#lb-discord-login").addEventListener("click", () => {
        supabase.auth.signInWithOAuth({ provider: "discord", options: { redirectTo: `${window.location.origin}/tierly` } });
      });
      renderPassportStats(null);
      return;
    }
    const displayName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email;
    el.innerHTML = `
      <div class="lb-session-pill">
        ${renderSessionAvatar(session.user)}
        <span>${t("loginedAs")} ${esc(displayName)}</span>
      </div>
      <div id="lb-discord-gate" class="lb-discord-gate"></div>`;
    checkDiscordMembership(session);
  }

  let passportStatsToken = 0;
  async function renderPassportStats(url = currentPassportUrl) {
    currentPassportUrl = url;
    const el = document.querySelector("#lb-passport-stats");
    if (!el) return;
    const token = ++passportStatsToken;
    if (!currentSession || !url) {
      el.innerHTML = `<p class="lb-profile-stats-empty">${t("passportStatsEmpty")}</p>`;
      return;
    }
    let username;
    try {
      const parsed = new URL(url);
      username = parsed.pathname.split("/").filter(Boolean).pop();
    } catch {
      username = null;
    }
    if (!username) {
      el.innerHTML = `<p class="lb-profile-stats-empty">${t("passportStatsEmpty")}</p>`;
      return;
    }
    el.innerHTML = `<p class="lb-profile-stats-empty">${t("passportStatsLoading")}</p>`;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/passport-profile?action=profile&username=${encodeURIComponent(username)}`, {
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });
      if (token !== passportStatsToken) return;
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (token !== passportStatsToken) return;
      const b = data.builder;
      if (!b) {
        el.innerHTML = `<p class="lb-profile-stats-empty">${t("passportStatsEmpty")}</p>`;
        return;
      }
      el.innerHTML = `
        <div class="lb-passport-stat-card">
          <a class="lb-passport-stat-header" href="${esc(url)}" target="_blank" rel="noopener noreferrer">
            ${renderImageWithFallback(b.logo_url, b.name, "lb-passport-stat-avatar")}
            <span>
              <span class="lb-passport-stat-name">${esc(b.name || username)}</span>
              <span class="lb-passport-stat-username">@${esc(b.username || username)}</span>
            </span>
          </a>
          ${b.description ? `<p class="lb-passport-stat-desc">${esc(b.description)}</p>` : ""}
          <div class="lb-passport-stat-meta">
            ${b.category ? `<span class="lb-passport-stat-chip">${t("passportStatCategory")}: <strong>${esc(b.category)}</strong></span>` : ""}
            ${b.stamp_count != null ? `<span class="lb-passport-stat-chip">${t("passportStatStamps")}: <strong>${esc(String(b.stamp_count))}</strong></span>` : ""}
          </div>
          ${b.website ? `<a class="lb-passport-stat-link" href="${esc(b.website)}" target="_blank" rel="noopener noreferrer">${t("passportStatWebsite")}</a>` : ""}
        </div>`;
    } catch {
      if (token !== passportStatsToken) return;
      el.innerHTML = `<p class="lb-profile-stats-empty">${t("passportStatsError")}</p>`;
    }
  }

  async function initAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    renderAuth(session);
    supabase.auth.onAuthStateChange((_event, newSession) => renderAuth(newSession));
  }

  function switchView(view) {
    activeView = view;
    document.querySelectorAll(".lb-view").forEach((section) => { section.hidden = section.dataset.view !== view; });
    document.querySelectorAll(".lb-nav-item").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.view === view));
  }

  function renderNav() {
    const el = document.querySelector("#lb-nav");
    if (!el) return;
    el.innerHTML = `
      <button class="lb-nav-item${activeView === "ranking" ? " is-active" : ""}" data-view="ranking"><i data-lucide="trophy"></i><span>${t("navRanking")}</span></button>
      <button class="lb-nav-item${activeView === "bracket" ? " is-active" : ""}" data-view="bracket"><i data-lucide="calendar-days"></i><span>${t("navBracket")}</span></button>
      <button class="lb-nav-item${activeView === "rewards" ? " is-active" : ""}" data-view="rewards"><i data-lucide="gift"></i><span>${t("navRewards")}</span></button>
      <button class="lb-nav-item${activeView === "profile" ? " is-active" : ""}" data-view="profile"><i data-lucide="user"></i><span>${t("navProfile")}</span></button>
      <button class="lb-nav-item${activeView === "settings" ? " is-active" : ""}" data-view="settings"><i data-lucide="settings"></i><span>${t("navSettings")}</span></button>`;
    el.querySelectorAll("button").forEach((btn) => btn.addEventListener("click", () => switchView(btn.dataset.view)));
    window.lucide?.createIcons();
  }

  function renderRankTabs() {
    const el = document.querySelector("#lb-rank-tabs");
    if (!el) return;
    el.innerHTML = `
      <button data-limit="5" class="${rankingLimit === 5 ? "is-active" : ""}">${t("top5")}</button>
      <button data-limit="50" class="${rankingLimit === 50 ? "is-active" : ""}">${t("all")}</button>`;
    el.querySelectorAll("button").forEach((btn) => btn.addEventListener("click", () => {
      rankingLimit = Number(btn.dataset.limit);
      renderRankTabs();
      renderRankingRows();
    }));
  }

  function renderPassportResults(builders) {
    const el = document.querySelector("#lb-passport-results");
    if (!el) return;
    if (!builders.length) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    el.hidden = false;
    el.innerHTML = `
      <div class="lb-passport-results-label">${t("passportResultsLabel")}</div>
      ${builders.map((b) => `
        <a class="lb-passport-result-row" href="https://demo.stellarpassport.xyz/builder/${encodeURIComponent(b.username)}" target="_blank" rel="noopener noreferrer">
              ${renderImageWithFallback(b.logo_url, b.name, "lb-passport-result-avatar")}
          <span class="lb-passport-result-name">${esc(b.name)}</span>
          <span class="lb-passport-result-username">@${esc(b.username)}</span>
        </a>`).join("")}`;
  }

  let passportSearchToken = 0;
  async function searchPassportBuilders(query) {
    const token = ++passportSearchToken;
    if (query.trim().length < 2) {
      renderPassportResults([]);
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/passport-profile?action=builders&q=${encodeURIComponent(query.trim())}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok || token !== passportSearchToken) return;
      const data = await res.json();
      if (token === passportSearchToken) renderPassportResults(data.builders || []);
    } catch {
      // Silent — Passport results are a bonus on top of the local ranking search.
    }
  }

  let passportSearchTimer = null;
  function renderRankSearch() {
    const input = document.querySelector("#lb-player-search");
    if (!input) return;
    input.placeholder = t("searchPlaceholder");
    input.addEventListener("input", () => {
      rankingSearch = input.value;
      document.querySelector("#lb-rank-tabs").hidden = rankingSearch.trim().length > 0;
      renderRankingRows();
      clearTimeout(passportSearchTimer);
      passportSearchTimer = setTimeout(() => searchPassportBuilders(rankingSearch), 300);
    });
  }

  function applyTheme(newTheme) {
    if (newTheme === theme) return;
    theme = newTheme;
    localStorage.setItem("tellus-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    renderSettingsView();
  }

  function renderSettingsView() {
    const el = document.querySelector("#lb-settings");
    if (!el) return;
    el.innerHTML = `
      <div class="lb-settings-block">
        <span class="lb-settings-label">${t("settingsLangLabel")}</span>
        <div class="lb-settings-lang" id="lb-settings-lang"></div>
      </div>
      <div class="lb-settings-block">
        <span class="lb-settings-label">${t("settingsThemeLabel")}</span>
        <div class="lb-settings-lang" id="lb-settings-theme"></div>
      </div>
      <p class="lb-settings-about">${t("settingsAbout")}</p>`;
    const langEl = document.querySelector("#lb-settings-lang");
    langEl.innerHTML = `
      <button data-lang="en" class="${lang === "en" ? "is-active" : ""}">English</button>
      <button data-lang="es" class="${lang === "es" ? "is-active" : ""}">Español</button>`;
    langEl.querySelectorAll("button").forEach((btn) => btn.addEventListener("click", () => applyLang(btn.dataset.lang)));
    const themeEl = document.querySelector("#lb-settings-theme");
    themeEl.innerHTML = `
      <button data-theme="light" class="${theme === "light" ? "is-active" : ""}">${t("themeLight")}</button>
      <button data-theme="dark" class="${theme === "dark" ? "is-active" : ""}">${t("themeDark")}</button>`;
    themeEl.querySelectorAll("button").forEach((btn) => btn.addEventListener("click", () => applyTheme(btn.dataset.theme)));
  }

  function renderStaticText() {
    document.querySelector("#lb-title").textContent = t("title");
    document.querySelector("#lb-subtitle").textContent = t("subtitle");
    document.querySelector("#lb-ranking-title").textContent = t("rankingTitle");
    document.querySelector("#lb-bracket-title").textContent = t("bracketTitle");
    document.querySelector("#lb-rewards-title").textContent = t("rewardsTitle");
    document.querySelector("#lb-profile-title").textContent = t("profileTitle");
    document.querySelector("#lb-passport-stats-title").textContent = t("passportStatsTitle");
    document.querySelector("#lb-profile-account-title").textContent = t("profileAccountTitle");
    document.querySelector("#lb-settings-title").textContent = t("settingsTitle");
    document.querySelector("#lb-view-full").textContent = t("viewFull") + " →";
    document.querySelector("#lb-sidebar-promo-text").textContent = t("promoSidebar");
    document.querySelector("#lb-upcoming-title").textContent = t("upcomingEventsTitle");
    document.querySelector("#lb-activity-title").textContent = t("recentActivityTitle");
  }

  function applyLang(newLang) {
    if (newLang === lang) return;
    lang = newLang;
    localStorage.setItem("tellus-lang", lang);
    renderStaticText();
    renderNav();
    renderRankTabs();
    renderRankSearch();
    renderSettingsView();
    renderPassportStats();
    renderStats();
    loadRanking();
    loadLatestBracket();
    loadRewards();
  }

  document.querySelector("#lb-view-full").addEventListener("click", () => {
    rankingLimit = 50;
    renderRankTabs();
    renderRankingRows();
  });

  renderStaticText();
  renderNav();
  renderRankTabs();
  renderRankSearch();
  renderSettingsView();
  renderFooter();
  renderPassportStats();
  switchView("ranking");

  initAuth();

  const rankingPromise = loadRanking();
  const bracketPromise = loadLatestBracket();
  const rewardsPromise = loadRewards();
  Promise.all([rankingPromise, bracketPromise, rewardsPromise]).then(renderStats);
})();
