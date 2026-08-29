// tierly/app.js
import { GAMING_TIERS, GAMING_RANKS, rankForPoints, nextRankForPoints } from "./ranks.mjs";
import { calculatePoints } from "./points.mjs";

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
      seasonResetsOn: "Season resets on {date}",
      bracketTitle: "Latest event", rewardsTitle: "Winners & rewards",
      navRanking: "Leaderboard", navBracket: "Events", navRewards: "Rewards", navProfile: "Profile", navSettings: "Settings",
      profileTitle: "Profile",
      profileHistoryTitle: "Recent history",
      profileStatRank: "Ranking position", profileStatEvents: "Events played",
      profileStatWins: "Wins", profileStatTop3: "Top 3 finishes", profileStatWinRate: "Win rate",
      profileLoginPrompt: "Sign in with Discord to see your stats.",
      streakTitle: "Current streak", streakMonth: "month", streakMonths: "months",
      streakActive: "Keep playing to grow your streak", streakInactive: "Join an event to start a streak",
      streakNextReward: "Next reward", streakMonthsToGo: "{months} to go",
      tierBronze: "Bronze", tierSilver: "Silver", tierGold: "Gold", tierPlatinum: "Platinum", tierDiamond: "Diamond",
      tierMax: "Max tier reached", tierProgress: "{points} pts to {tier}",
      ranksInfoBtn: "View ranks", ranksModalTitle: "Ranks & how they work",
      ranksModalIntro: "Every rank has 3 divisions (1, 2 and 3). You start at division 1 and climb to 2 and 3 by earning points, then move up to the next rank.",
      ranksModalPoints: "You earn points by playing events: 10 pts for 1st place, 6 for 2nd, 3 for 3rd, and 1 just for taking part.",
      ranksModalClose: "Close",
      ranksModalPtsFrom: "from {points} pts",
      tierDescBronze: "Everyone starts here. Rack up points in events to start climbing.",
      tierDescSilver: "You've shown you're consistent on the leaderboard.",
      tierDescGold: "A standout player, among the server's best.",
      tierDescPlatinum: "Elite level — few players make it this far.",
      tierDescDiamond: "The highest rank. Reserved for the season's very best.",
      profileHistoryEmpty: "No matches played yet.",
      playerBackBtn: "← Back to leaderboard",
      playerNotFound: "This profile isn't available.",
      top5: "Top 5", all: "All Players", viewFull: "View Full Leaderboard", searchPlaceholder: "Search player…",
      tier: "Tier", searchResultsLabel: "Search results",
      searchNoResults: "No players match that name.", searchLoading: "Searching…",
      searchNoProfile: "This player hasn't set up a public profile yet.",
      loginDiscord: "Sign in with Discord", loginedAs: "Signed in as",
      signOutBtn: "Sign out",
      profileEditBtn: "Edit profile", profileEditBtnClose: "Done",
      bannerPickerTitle: "Choose a banner",
      bannerAdjustBtn: "Adjust position", bannerAdjustTitle: "Adjust your banner",
      bannerAdjustCancel: "Cancel", bannerAdjustApply: "Apply",
      passportUnlinkBtn: "Unlink",
      profileSaveBtn: "Save profile",
      profileDisplayNameLabel: "Display name",
      profileBioLabel: "Bio",
      profileTwitterLabel: "X handle",
      profileInstagramLabel: "Instagram handle",
      profileTelegramLabel: "Telegram handle",
      profileDiscordLabel: "Discord handle",
      profileLinkedHint: "These fields are copied from Stellar Passport when you link. You can edit them here. To sync from Passport again, unlink and link again.",
      profileSaved: "Profile saved.",
      profileSettingsTitle: "Profile settings",
      profilePassportLinked: "Passport linked",
      profilePassportNotLinked: "Passport not linked",
      profilePassportLinkAction: "Link Stellar Passport",
      profilePassportUnlinkAction: "Unlink Stellar Passport",
      profileBannerAction: "Change banner",
      profileLogoutAction: "Sign out",
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
      profileSyncing: "Syncing your profile…",
      profileSyncRetry: "Retry",
      navChess: "Chess",
      chessBotTitle: "Play the Bot",
      chessChallengeTitle: "Challenge a Player",
      chessChallengePlaceholder: "Enter a player's username…",
      chessChallengeBtn: "Challenge",
      chessMyGames: "My games",
      chessStart: "Start game",
      chessEasy: "Easy",
      chessMedium: "Medium",
      chessHard: "Hard",
      chessAccept: "Accept",
      chessDecline: "Decline",
      chessResign: "Resign",
      chessYouWin: "You win!",
      chessYouLose: "You lose…",
      chessDraw: "Draw.",
      chessFinished: "Game finished",
      chessWaitingOpponent: "Waiting for the challenge to be accepted…",
      chessTurn: "Your turn",
      chessError: "Something went wrong, try again.",
      chessLoading: "Loading…",
      chessBot: "Bot",
      chessCancel: "Cancel",
      chessEmpty: "No games yet.",
      chessPending: "Pending",
      chessActive: "In progress",
      chessPlay: "Play",
      chessLogin: "Sign in to play chess.",
      chessSyncError: "Something went wrong syncing your profile. Check your profile and retry.",
      lbBack: "Back",
    },
    es: {
      title: "Leaderboard Gaming Tierly",
      subtitle: "Compite en eventos. Sube en el ranking. Gana premios.",
      rank: "Puesto", player: "Jugador", points: "Puntos",
      rankingTitle: "Mejores jugadores",
      seasonResetsOn: "La temporada se reinicia el {date}",
      bracketTitle: "Último evento", rewardsTitle: "Ganadores y premios",
      navRanking: "Leaderboard", navBracket: "Eventos", navRewards: "Premios", navProfile: "Perfil", navSettings: "Configuración",
      profileTitle: "Perfil",
      profileHistoryTitle: "Historial reciente",
      profileStatRank: "Posición en el ranking", profileStatEvents: "Eventos jugados",
      profileStatWins: "Victorias", profileStatTop3: "Top 3", profileStatWinRate: "Win rate",
      profileLoginPrompt: "Inicia sesión con Discord para ver tus estadísticas.",
      streakTitle: "Racha actual", streakMonth: "mes", streakMonths: "meses",
      streakActive: "Sigue jugando para mantener tu racha", streakInactive: "Únete a un evento para empezar tu racha",
      streakNextReward: "Próxima recompensa", streakMonthsToGo: "faltan {months}",
      tierBronze: "Bronce", tierSilver: "Plata", tierGold: "Oro", tierPlatinum: "Platino", tierDiamond: "Diamante",
      tierMax: "Rango máximo alcanzado", tierProgress: "{points} pts para {tier}",
      ranksInfoBtn: "Ver rangos", ranksModalTitle: "Rangos y cómo funcionan",
      ranksModalIntro: "Cada rango tiene 3 divisiones (1, 2 y 3). Empiezas en la división 1 y subes a la 2 y 3 sumando puntos, hasta pasar al siguiente rango.",
      ranksModalPoints: "Ganas puntos jugando eventos: 10 pts por 1er puesto, 6 por 2do, 3 por 3ro, y 1 solo por participar.",
      ranksModalClose: "Cerrar",
      ranksModalPtsFrom: "desde {points} pts",
      tierDescBronze: "Todos empiezan aquí. Gana puntos en eventos para empezar a subir.",
      tierDescSilver: "Ya has demostrado constancia en el ranking.",
      tierDescGold: "Un jugador destacado, entre los mejores del servidor.",
      tierDescPlatinum: "Nivel de élite — pocos jugadores llegan tan lejos.",
      tierDescDiamond: "El rango más alto. Reservado para los mejores de la temporada.",
      profileHistoryEmpty: "Todavía no has jugado ninguna partida.",
      playerBackBtn: "← Volver al ranking",
      playerNotFound: "Este perfil no está disponible.",
      top5: "Top 5", all: "Todos", viewFull: "Ver leaderboard completo", searchPlaceholder: "Buscar jugador…",
      tier: "Rango", searchResultsLabel: "Resultados de búsqueda",
      searchNoResults: "Ningún jugador coincide con ese nombre.", searchLoading: "Buscando…",
      searchNoProfile: "Este jugador todavía no tiene perfil público.",
      loginDiscord: "Iniciar sesión con Discord", loginedAs: "Sesión iniciada como",
      signOutBtn: "Cerrar sesión",
      profileEditBtn: "Editar perfil", profileEditBtnClose: "Listo",
      bannerPickerTitle: "Elige un banner",
      bannerAdjustBtn: "Ajustar posición", bannerAdjustTitle: "Ajusta tu banner",
      bannerAdjustCancel: "Cancelar", bannerAdjustApply: "Aplicar",
      passportUnlinkBtn: "Desvincular",
      profileSaveBtn: "Guardar perfil",
      profileDisplayNameLabel: "Nombre para mostrar",
      profileBioLabel: "Biografía",
      profileTwitterLabel: "Usuario de X",
      profileInstagramLabel: "Usuario de Instagram",
      profileTelegramLabel: "Usuario de Telegram",
      profileDiscordLabel: "Usuario de Discord",
      profileLinkedHint: "Estos campos se copian desde Stellar Passport cuando vinculas tu cuenta. Después puedes editarlos aquí. Si quieres volver a sincronizar con Passport, desvincula y vincula de nuevo.",
      profileSaved: "Perfil guardado.",
      profileSettingsTitle: "Configuración del perfil",
      profilePassportLinked: "Passport vinculado",
      profilePassportNotLinked: "Passport no vinculado",
      profilePassportLinkAction: "Vincular Stellar Passport",
      profilePassportUnlinkAction: "Desvincular Stellar Passport",
      profileBannerAction: "Cambiar banner",
      profileLogoutAction: "Cerrar sesión",
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
      passportPlaceholder: "Busca tu handle de Stellar Passport…",
      passportLinkBtn: "Vincular",
      passportLinkError: "No pudimos vincular este perfil. Revisa el handle e inténtalo de nuevo.",
      passportLinked: "Perfil de Stellar Passport ↗",
      passportResultsLabel: "También en Stellar Passport",
      passportNoMatches: "No encontramos coincidencias",
      discordJoinBody: "Debes unirte al servidor de Discord de Tellus para participar — Tierly comprueba tu membresía antes de desbloquear cualquier cosa.",
      discordJoinBtn: "Unirse al Discord de Tellus",
      discordVerifyBtn: "Ya me uní · Verificar",
      discordChecking: "Comprobando tu membresía…",
      discordVerifyError: "No pudimos comprobar Discord ahora. Inténtalo de nuevo en un momento.",
      profileSyncing: "Sincronizando tu perfil…",
      profileSyncRetry: "Reintentar",
      navChess: "Ajedrez",
      chessBotTitle: "Jugar contra el bot",
      chessChallengeTitle: "Desafiar a un jugador",
      chessChallengePlaceholder: "Ingresá el usuario del jugador…",
      chessChallengeBtn: "Desafiar",
      chessMyGames: "Mis partidas",
      chessStart: "Empezar partida",
      chessEasy: "Fácil",
      chessMedium: "Medio",
      chessHard: "Difícil",
      chessAccept: "Aceptar",
      chessDecline: "Rechazar",
      chessResign: "Abandonar",
      chessYouWin: "¡Ganaste!",
      chessYouLose: "Perdiste…",
      chessDraw: "Empate.",
      chessFinished: "Partida terminada",
      chessWaitingOpponent: "Esperando que acepten el desafío…",
      chessTurn: "Tu turno",
      chessError: "Algo salió mal, probá de nuevo.",
      chessLoading: "Cargando…",
      chessBot: "Bot",
      chessCancel: "Cancelar",
      chessEmpty: "Todavía no hay partidas.",
      chessPending: "Pendiente",
      chessActive: "En curso",
      chessPlay: "Jugar",
      chessLogin: "Iniciá sesión para jugar al ajedrez.",
      chessSyncError: "Falló la sincronización de tu perfil. Revisá tu perfil y reintentá.",
      lbBack: "Volver",
    },
  };
  const X_ICON = `<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
  const TELEGRAM_ICON = `<svg viewBox="0 0 24 24"><path d="M21.944 4.198a1.5 1.5 0 00-1.53-.211L2.7 10.94a1.4 1.4 0 00.106 2.62l4.52 1.47 1.74 5.55a1.2 1.2 0 001.93.55l2.6-2.14 4.46 3.3a1.4 1.4 0 002.2-.86l3-15.4a1.5 1.5 0 00-.312-1.23zM9.1 14.53l-1.06-3.4 9.9-6.2-8.84 9.6z"/></svg>`;
  const DISCORD_ICON = `<svg viewBox="0 0 24 24"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8649-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3846-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.522 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>`;
  const INSTAGRAM_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>`;
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
  let currentPlayer = null;
  let currentPassportUrl = null;
  let profileSyncState = "idle"; // idle | loading | ready | error
  let profileSyncError = "";
  let activeView = "ranking";
  let rankingLimit = 5;
  let rankingSearch = "";
  let rankingRows = [];
  let playerSearchRows = [];
  let playerSearchLoading = false;
  let playerSearchToken = 0;
  let playerSearchTimer = null;
  let bracketRows = [];
  let rewardsRows = [];
  let viewingPlayer = null;

  window.TierlyBridge = {
    supabase,
    t: (key) => t(key),
    session: () => currentSession,
    player: () => currentPlayer,
    syncState: () => profileSyncState,
    switchView: (view) => switchView(view),
  };

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

  function syncCurrentPlayer(player, fallbackUrl = null) {
    currentPlayer = player || null;
    profileSyncState = currentPlayer ? "ready" : profileSyncState;
    currentPassportUrl = player?.stellar_passport_url || fallbackUrl || null;
    if (player?.banner) {
      profileBanner = player.banner;
      localStorage.setItem("tellus-profile-banner", profileBanner);
      if (player.banner_fit && typeof player.banner_fit === "object") {
        profileBannerFit = clampCropFit({
          tx: Number.isFinite(player.banner_fit.tx) ? player.banner_fit.tx : 0,
          ty: Number.isFinite(player.banner_fit.ty) ? player.banner_fit.ty : 0,
          zoom: Number.isFinite(player.banner_fit.zoom) ? player.banner_fit.zoom : 100,
        });
        saveBannerFit();
      }
      renderProfileBanner();
    }
  }

  function getCurrentPassportUsername() {
    if (!currentPassportUrl) return currentPlayer?.stellar_passport_username || null;
    try {
      const parsed = new URL(currentPassportUrl);
      return parsed.pathname.split("/").filter(Boolean).pop() || null;
    } catch {
      return null;
    }
  }

  function renderProfileAvatar() {
    const avatarEl = document.querySelector("#lb-profile-avatar");
    if (!avatarEl) return;
    if (!currentSession) {
      avatarEl.innerHTML = "";
      return;
    }
    const preferredName = currentPlayer?.display_name
      || currentSession.user.user_metadata?.full_name
      || currentSession.user.user_metadata?.name
      || currentSession.user.email
      || "?";
    const preferredAvatar = currentPlayer?.avatar_url || resolveAvatarUrl(currentSession.user);
    avatarEl.innerHTML = renderImageWithFallback(preferredAvatar, preferredName, "lb-session-avatar");
  }

  function profileSocials(player = currentPlayer) {
    return [
      player?.twitter_handle ? { href: `https://twitter.com/${player.twitter_handle}`, label: `@${player.twitter_handle}`, icon: X_ICON } : null,
      player?.instagram_handle ? { href: `https://instagram.com/${player.instagram_handle}`, label: `@${player.instagram_handle}`, icon: INSTAGRAM_ICON } : null,
      player?.telegram_handle ? { href: `https://t.me/${player.telegram_handle}`, label: `@${player.telegram_handle}`, icon: TELEGRAM_ICON } : null,
      player?.discord_handle ? { href: null, label: `@${player.discord_handle}`, icon: DISCORD_ICON } : null,
    ].filter(Boolean);
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
    const query = rankingSearch.trim();
    if (!query) {
      const rows = rankingRows.slice(0, rankingLimit);
      el.innerHTML = `
        <div class="lb-rank-list">
          <div class="lb-rank-head"><span>${t("rank")}</span><span>${t("player")}</span><span>${t("points")}</span></div>
          ${rows.map((row) => {
            const rank = rankingRows.indexOf(row) + 1;
            const tierClass = rank <= 3 ? ` tier-${rank}` : "";
            const playerTier = rankForPoints(row.total_points || 0);
            const clickable = Boolean(row.username);
            return `
            <div class="lb-rank-row${rank === 1 ? " lb-rank-row-first" : ""}${clickable ? " lb-rank-row-clickable" : ""}"${clickable ? ` data-username="${esc(row.username)}" role="button" tabindex="0"` : ""}>
              <span class="lb-rank-badge${tierClass}">${rank}</span>
              <span class="lb-rank-player">
                ${renderImageWithFallback(row.avatar_url, row.display_name)}
                <span class="lb-rank-name">${esc(row.display_name || "—")}${row.discord_member ? CHECK_ICON : ""}</span>
                ${playerTier.icon ? `<img src="${playerTier.icon}" alt="" class="lb-rank-tier-icon" />` : ""}
              </span>
              <span class="lb-rank-points">${row.total_points}</span>
            </div>`;
          }).join("")}
        </div>`;
      bindRankRowClicks(el);
      return;
    }
    const lowerQuery = query.toLowerCase();
    const rows = playerSearchRows.length
      ? playerSearchRows
      : rankingRows.filter((row) => (row.display_name || "").toLowerCase().includes(lowerQuery));
    if (!rows.length) {
      el.innerHTML = `<p class="lb-empty">${playerSearchLoading ? t("searchLoading") : t("searchNoResults")}</p>`;
      return;
    }
    el.innerHTML = `
      <div class="lb-rank-list">
        <div class="lb-rank-head lb-rank-results-label"><span>${t("tier")}</span><span>${t("player")}</span><span>${t("points")}</span></div>
        ${rows.map((row) => {
          const playerTier = rankForPoints(row.total_points || 0);
          const clickable = Boolean(row.username);
          return `
          <div class="lb-rank-row${clickable ? " lb-rank-row-clickable" : ""}"${clickable ? ` data-username="${esc(row.username)}" role="button" tabindex="0"` : ` title="${esc(t("searchNoProfile"))}"`}>
            <span class="lb-rank-badge">${playerTier.icon ? `<img src="${playerTier.icon}" alt="${esc(t(TIER_LABEL_KEY[playerTier.tierId] || ""))}" class="lb-rank-tier-icon" />` : ""}</span>
            <span class="lb-rank-player">
              ${renderImageWithFallback(row.avatar_url, row.display_name)}
              <span class="lb-rank-name">${esc(row.display_name || "—")}${row.discord_member ? CHECK_ICON : ""}</span>
            </span>
            <span class="lb-rank-points">${row.total_points}</span>
          </div>`;
        }).join("")}
      </div>`;
    bindRankRowClicks(el);
  }

  function bindRankRowClicks(el) {
    el.querySelectorAll("[data-username]").forEach((rowEl) => {
      const open = () => openPlayerProfile(rowEl.dataset.username);
      rowEl.addEventListener("click", open);
      rowEl.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
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

  async function openPlayerProfile(username) {
    if (!username) return;
    let player = rankingRows.find((row) => row.username === username) || null;
    if (!player) {
      const { data } = await supabase.from("leaderboard_public_view").select("*").eq("username", username).maybeSingle();
      player = data || null;
    }
    viewingPlayer = player;
    if (location.hash !== `#u/${username}`) location.hash = `u/${encodeURIComponent(username)}`;
    renderPlayerProfile();
    switchView("player");
  }

  function renderPlayerProfile() {
    const avatarEl = document.querySelector("#lb-player-avatar");
    const summaryEl = document.querySelector("#lb-player-summary");
    const tierEl = document.querySelector("#lb-player-tier");
    const statsEl = document.querySelector("#lb-player-stats");
    const bannerEl = document.querySelector("#lb-player-banner");
    const bannerImgEl = document.querySelector("#lb-player-banner-img");
    if (!avatarEl || !summaryEl || !tierEl || !statsEl) return;
    if (!viewingPlayer) {
      avatarEl.innerHTML = "";
      summaryEl.innerHTML = `<p class="lb-profile-stats-empty">${t("playerNotFound")}</p>`;
      tierEl.innerHTML = "";
      statsEl.innerHTML = "";
      if (bannerEl) bannerEl.hidden = true;
      return;
    }
    if (bannerEl && bannerImgEl) {
      if (viewingPlayer.banner) {
        bannerImgEl.src = `/tierly/banners/${viewingPlayer.banner}`;
        const fit = viewingPlayer.banner_fit && typeof viewingPlayer.banner_fit === "object"
          ? viewingPlayer.banner_fit
          : { tx: 0, ty: 0, zoom: 100 };
        bannerImgEl.style.transform = bannerFitTransform(fit);
        bannerEl.hidden = false;
      } else {
        bannerEl.hidden = true;
      }
    }
    avatarEl.innerHTML = renderImageWithFallback(viewingPlayer.avatar_url, viewingPlayer.display_name, "lb-session-avatar");
    summaryEl.innerHTML = `
      <div class="lb-profile-summary-block">
        <div class="lb-profile-summary-head">
          <strong class="lb-profile-summary-name">${esc(viewingPlayer.display_name || "—")}</strong>${viewingPlayer.discord_member ? CHECK_ICON : ""}
        </div>
        ${viewingPlayer.bio ? `<p class="lb-profile-summary-bio">${esc(viewingPlayer.bio)}</p>` : ""}
      </div>`;
    const points = viewingPlayer.total_points || 0;
    const rank = rankingRows.findIndex((row) => row.player_id === viewingPlayer.player_id) + 1;
    renderProfileTier(points, "#lb-player-tier");
    const playerBrackets = bracketRows.filter((r) => r.player_id === viewingPlayer.player_id);
    const eventsPlayed = new Set(playerBrackets.map((r) => r.event_id)).size;
    const wins = playerBrackets.filter((r) => r.placement === 1).length;
    statsEl.innerHTML = `
      <div class="lb-stat-card">
        <span class="lb-stat-icon"><i data-lucide="trophy"></i></span>
        <div><span class="lb-stat-label">${t("profileStatRank")}</span><strong>${rank ? `#${rank}` : "—"}</strong></div>
      </div>
      <div class="lb-stat-card">
        <span class="lb-stat-icon"><i data-lucide="star"></i></span>
        <div><span class="lb-stat-label">${t("points")}</span><strong>${points}</strong></div>
      </div>
      <div class="lb-stat-card">
        <span class="lb-stat-icon"><i data-lucide="calendar-days"></i></span>
        <div><span class="lb-stat-label">${t("profileStatEvents")}</span><strong>${eventsPlayed}</strong></div>
      </div>
      <div class="lb-stat-card">
        <span class="lb-stat-icon"><i data-lucide="crown"></i></span>
        <div><span class="lb-stat-label">${t("profileStatWins")}</span><strong>${wins}</strong></div>
      </div>`;
    window.lucide?.createIcons();
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

  const TIER_LABEL_KEY = { bronze: "tierBronze", silver: "tierSilver", gold: "tierGold", platinum: "tierPlatinum", diamond: "tierDiamond" };

  function renderProfileTier(points, selector = "#lb-profile-tier") {
    const el = document.querySelector(selector);
    if (!el) return;
    const rank = rankForPoints(points);
    const next = nextRankForPoints(points);
    const label = `${t(TIER_LABEL_KEY[rank.tierId])} ${rank.division}`;
    const progress = next
      ? t("tierProgress").replace("{points}", next.min - points).replace("{tier}", `${t(TIER_LABEL_KEY[next.tierId])} ${next.division}`)
      : t("tierMax");
    const iconHtml = rank.icon
      ? `<img src="${rank.icon}" alt="${esc(label)}" class="lb-profile-tier-icon" />`
      : `<span class="lb-profile-tier-icon lb-profile-tier-icon-fallback"><i data-lucide="gem"></i></span>`;
    el.innerHTML = `
      ${iconHtml}
      <div class="lb-profile-tier-text">
        <strong>${esc(label)}</strong>
        <span class="lb-profile-tier-progress">${esc(progress)}</span>
      </div>`;
    window.lucide?.createIcons();
  }

  const TIER_DESC_KEY = { bronze: "tierDescBronze", silver: "tierDescSilver", gold: "tierDescGold", platinum: "tierDescPlatinum", diamond: "tierDescDiamond" };

  function renderRanksModal() {
    document.querySelector("#lb-ranks-modal-title").textContent = t("ranksModalTitle");
    document.querySelector("#lb-ranks-modal-intro").textContent = t("ranksModalIntro");
    document.querySelector("#lb-ranks-modal-points").textContent = t("ranksModalPoints");
    const list = document.querySelector("#lb-ranks-modal-list");
    list.innerHTML = GAMING_TIERS.map((tier) => {
      const label = t(TIER_LABEL_KEY[tier.id]);
      const iconHtml = tier.icon
        ? `<img src="${tier.icon}" alt="${esc(label)}" class="lb-ranks-modal-tier-icon" />`
        : `<span class="lb-ranks-modal-tier-icon-fallback"><i data-lucide="gem"></i></span>`;
      const divisionsHtml = tier.divisions
        .map((min, i) => `<div class="lb-ranks-modal-division"><strong>${i + 1}</strong><span>${t("ranksModalPtsFrom").replace("{points}", min)}</span></div>`)
        .join("");
      return `
        <details class="lb-ranks-modal-tier">
          <summary class="lb-ranks-modal-tier-summary">
            ${iconHtml}
            <span class="lb-ranks-modal-tier-name">${esc(label)}</span>
            <span class="lb-ranks-modal-tier-range">${t("ranksModalPtsFrom").replace("{points}", tier.divisions[0])}</span>
          </summary>
          <div class="lb-ranks-modal-tier-body">
            <p>${esc(t(TIER_DESC_KEY[tier.id]))}</p>
            <div class="lb-ranks-modal-divisions">${divisionsHtml}</div>
          </div>
        </details>`;
    }).join("");
    window.lucide?.createIcons();
  }

  function currentPlayerId() {
    return currentSession ? currentPlayer?.id || null : null;
  }

  function profileSyncErrorBlock() {
    const detail = profileSyncError ? ` ${esc(profileSyncError)}` : "";
    return `<p class="lb-profile-stats-empty">${t("discordVerifyError")}${detail}</p>
      <p class="lb-profile-stats-empty"><button type="button" class="lb-gate-retry" data-sync-retry>${t("profileSyncRetry")}</button></p>`;
  }

  function wireSyncRetry() {
    document.querySelectorAll("[data-sync-retry]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!currentSession) return;
        const { data: fresh } = await supabase.auth.getSession();
        checkDiscordMembership(fresh.session || currentSession);
      });
    });
  }

  function renderProfileStats() {
    const el = document.querySelector("#lb-profile-stats");
    if (!el) return;
    const playerId = currentPlayerId();
    if (!playerId) {
      if (!currentSession) {
        el.innerHTML = `<p class="lb-profile-stats-empty">${t("profileLoginPrompt")}</p>`;
      } else if (profileSyncState === "error") {
        el.innerHTML = profileSyncErrorBlock();
        wireSyncRetry();
      } else {
        el.innerHTML = `<p class="lb-profile-stats-empty">${t("profileSyncing")}</p>`;
      }
      const tierEl = document.querySelector("#lb-profile-tier");
      if (tierEl) tierEl.innerHTML = "";
      const streakEl = document.querySelector("#lb-profile-streak");
      if (streakEl) streakEl.innerHTML = "";
      return;
    }
    const rankIndex = rankingRows.findIndex((r) => r.player_id === playerId);
    const rank = rankIndex >= 0 ? rankIndex + 1 : null;
    const points = rankIndex >= 0 ? rankingRows[rankIndex].total_points : 0;
    renderProfileTier(points);
    const playerBrackets = bracketRows.filter((r) => r.player_id === playerId);
    const eventsPlayed = new Set(playerBrackets.map((r) => r.event_id)).size;
    const rewardsCount = rewardsRows.filter((r) => r.player_id === playerId).length;
    const wins = playerBrackets.filter((r) => r.placement === 1).length;
    const top3 = playerBrackets.filter((r) => r.placement && r.placement <= 3).length;
    const winRate = eventsPlayed ? Math.round((wins / eventsPlayed) * 100) : 0;
    renderProfileStreak(playerBrackets);
    el.innerHTML = `
      <div class="lb-stat-card">
        <span class="lb-stat-icon"><i data-lucide="trophy"></i></span>
        <div><span class="lb-stat-label">${t("profileStatRank")}</span><strong>${rank ? `#${rank}` : "—"}</strong></div>
      </div>
      <div class="lb-stat-card">
        <span class="lb-stat-icon"><i data-lucide="star"></i></span>
        <div><span class="lb-stat-label">${t("points")}</span><strong>${points}</strong></div>
      </div>
      <div class="lb-stat-card">
        <span class="lb-stat-icon"><i data-lucide="calendar-days"></i></span>
        <div><span class="lb-stat-label">${t("profileStatEvents")}</span><strong>${eventsPlayed}</strong></div>
      </div>
      <div class="lb-stat-card">
        <span class="lb-stat-icon"><i data-lucide="gift"></i></span>
        <div><span class="lb-stat-label">${t("statRewards")}</span><strong>${rewardsCount}</strong></div>
      </div>
      <div class="lb-stat-card">
        <span class="lb-stat-icon"><i data-lucide="crown"></i></span>
        <div><span class="lb-stat-label">${t("profileStatWins")}</span><strong>${wins}</strong></div>
      </div>
      <div class="lb-stat-card">
        <span class="lb-stat-icon"><i data-lucide="medal"></i></span>
        <div><span class="lb-stat-label">${t("profileStatTop3")}</span><strong>${top3}</strong></div>
      </div>
      <div class="lb-stat-card">
        <span class="lb-stat-icon"><i data-lucide="percent"></i></span>
        <div><span class="lb-stat-label">${t("profileStatWinRate")}</span><strong>${winRate}%</strong></div>
      </div>`;
    window.lucide?.createIcons();
  }

  const STREAK_CATS = [
    { minMonths: 0, src: "/tierly/streak/negro.png" },
    { minMonths: 3, src: "/tierly/streak/naranjo.png" },
    { minMonths: 6, src: "/tierly/streak/tuxedo.png" },
    { minMonths: 9, src: "/tierly/streak/dorado.png" },
  ];

  function computeStreakMonths(playerBrackets) {
    const months = new Set(playerBrackets.map((r) => (r.event_date || "").slice(0, 7)).filter(Boolean));
    if (!months.size) return 0;
    const latest = [...months].sort().pop();
    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);
    if (latest !== thisMonth && latest !== lastMonth) return 0;
    let cursor = new Date(`${latest}-01T00:00:00`);
    let streak = 0;
    while (months.has(cursor.toISOString().slice(0, 7))) {
      streak++;
      cursor.setMonth(cursor.getMonth() - 1);
    }
    return streak;
  }

  function catForStreak(months) {
    let current = STREAK_CATS[0];
    for (const cat of STREAK_CATS) if (months >= cat.minMonths) current = cat;
    return current;
  }

  function renderProfileStreak(playerBrackets) {
    const el = document.querySelector("#lb-profile-streak");
    if (!el) return;
    const months = computeStreakMonths(playerBrackets);
    const cat = catForStreak(months);
    const next = STREAK_CATS.find((c) => months < c.minMonths) || null;
    el.innerHTML = `
      <div class="lb-streak-card">
        <div class="lb-streak-info">
          <span class="lb-streak-label">${t("streakTitle")}</span>
          <strong class="lb-streak-count">${months} ${months === 1 ? t("streakMonth") : t("streakMonths")}</strong>
          <span class="lb-streak-sub">${months > 0 ? t("streakActive") : t("streakInactive")}</span>
          ${next ? `<span class="lb-streak-next">${t("streakNextReward")}: ${t("streakMonthsToGo").replace("{months}", next.minMonths - months)}</span>` : ""}
        </div>
        <img src="${cat.src}" alt="" class="lb-streak-cat" />
      </div>`;
  }

  function renderProfileHistory() {
    const el = document.querySelector("#lb-profile-history");
    if (!el) return;
    const playerId = currentPlayerId();
    if (!playerId) {
      if (!currentSession) {
        el.innerHTML = `<p class="lb-profile-stats-empty">${t("profileLoginPrompt")}</p>`;
      } else if (profileSyncState === "error") {
        el.innerHTML = profileSyncErrorBlock();
        wireSyncRetry();
      } else {
        el.innerHTML = `<p class="lb-profile-stats-empty">${t("profileSyncing")}</p>`;
      }
      return;
    }
    const rows = bracketRows
      .filter((r) => r.player_id === playerId)
      .sort((a, b) => (a.event_date < b.event_date ? 1 : -1))
      .slice(0, 8);
    if (!rows.length) {
      el.innerHTML = `<p class="lb-profile-history-empty">${t("profileHistoryEmpty")}</p>`;
      return;
    }
    el.innerHTML = rows.map((r) => `
      <div class="lb-profile-history-row">
        <span class="lb-rank-badge">${r.placement ? `#${r.placement}` : "—"}</span>
        <span class="lb-profile-history-event">${esc(r.event_name)} <span class="lb-profile-history-date">· ${esc(fmtEventDate(r.event_date))}</span></span>
        <span class="lb-profile-history-points">+${calculatePoints(r.placement)}</span>
      </div>`).join("");
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

  function renderProfileSummary() {
    const el = document.querySelector("#lb-profile-summary");
    if (!el) return;
    if (!currentSession) {
      el.innerHTML = "";
      return;
    }
    if (!profileBannerPickerOpen) {
      const socials = profileSocials();
      const displayName = currentPlayer?.display_name
        || currentPlayer?.stellar_passport_name
        || currentSession.user.user_metadata?.full_name
        || currentSession.user.user_metadata?.name
        || currentSession.user.email;
      const description = currentPlayer?.bio || currentPlayer?.stellar_passport_bio || "";
      console.log("[TIERLY DEBUG] renderProfileSummary:", JSON.stringify({ socialsCount: socials.length, displayName, description: description?.substring(0, 80), hasCurrentPlayer: !!currentPlayer, bio: currentPlayer?.bio, stellar_passport_bio: currentPlayer?.stellar_passport_bio, twitter: currentPlayer?.twitter_handle }));
      el.innerHTML = `
        <div class="lb-profile-summary-block">
          <div class="lb-profile-summary-head">
            <strong class="lb-profile-summary-name">${esc(displayName || "")}</strong>
            <button type="button" id="lb-profile-edit-btn" class="lb-profile-edit-btn">${t("profileEditBtn")}</button>
          </div>
          ${description ? `<p class="lb-profile-summary-bio">${esc(description)}</p>` : ""}
          ${socials.length ? `<div class="lb-profile-summary-socials">${socials.map((s) => s.href
            ? `<a href="${esc(s.href)}" target="_blank" rel="noopener noreferrer">${s.icon}<span>${esc(s.label)}</span></a>`
            : `<span class="lb-passport-stat-social-static">${s.icon}<span>${esc(s.label)}</span></span>`).join("")}</div>` : ""}
        </div>`;
      document.querySelector("#lb-profile-edit-btn")?.addEventListener("click", toggleProfileEdit);
      return;
    }
    const sessionDisplayName = currentSession.user.user_metadata?.full_name || currentSession.user.user_metadata?.name || currentSession.user.email;
    const passportUsername = getCurrentPassportUsername();
    el.innerHTML = `
      <div class="lb-profile-edit-panel">
        <div class="lb-profile-edit-section">
          <div class="lb-profile-edit-section-head">
            <span class="lb-profile-edit-label">${t("bannerPickerTitle")}</span>
            <button type="button" id="lb-profile-edit-done" class="lb-profile-edit-btn">${t("profileEditBtnClose")}</button>
          </div>
          <div id="lb-profile-banner-picker" class="lb-profile-banner-picker"></div>
          <button type="button" id="lb-profile-banner-adjust-btn" class="lb-profile-banner-adjust-btn">${t("bannerAdjustBtn")}</button>
        </div>
        <div class="lb-profile-edit-section">
          <span class="lb-profile-edit-label">${t("profileSettingsTitle")}</span>
          <div class="lb-profile-settings-actions">
            <div class="lb-profile-setting-row">
              <span class="lb-profile-setting-info">${t("loginedAs")} ${esc(sessionDisplayName || "")}</span>
            </div>
            <div class="lb-profile-setting-row">
              <span class="lb-verified-badge">✓ ${t("verified")}</span>
            </div>
            ${passportUsername ? `<div class="lb-profile-setting-row">
              <a href="${esc(currentPassportUrl || "")}" target="_blank" rel="noopener noreferrer" class="lb-passport-linked">${t("passportLinked")}</a>
            </div>` : ""}
            <div class="lb-profile-setting-row">
              <label class="lb-profile-edit-field-label">${t("profileDisplayNameLabel")}</label>
              <input id="lb-profile-edit-display-name" class="lb-profile-form-input" type="text" value="${esc(currentPlayer?.display_name || "")}" maxlength="120" />
            </div>
            <div class="lb-profile-setting-row">
              <label class="lb-profile-edit-field-label">${t("profileBioLabel")}</label>
              <textarea id="lb-profile-edit-bio" class="lb-profile-form-input" rows="3" maxlength="500">${esc(currentPlayer?.bio || "")}</textarea>
            </div>
            <div class="lb-profile-setting-row">
              <label class="lb-profile-edit-field-label">${t("profileTwitterLabel")}</label>
              <input id="lb-profile-edit-twitter" class="lb-profile-form-input" type="text" value="${esc(currentPlayer?.twitter_handle || "")}" placeholder="@handle" />
            </div>
            <div class="lb-profile-setting-row">
              <label class="lb-profile-edit-field-label">${t("profileInstagramLabel")}</label>
              <input id="lb-profile-edit-instagram" class="lb-profile-form-input" type="text" value="${esc(currentPlayer?.instagram_handle || "")}" placeholder="@handle" />
            </div>
            <div class="lb-profile-setting-row">
              <label class="lb-profile-edit-field-label">${t("profileTelegramLabel")}</label>
              <input id="lb-profile-edit-telegram" class="lb-profile-form-input" type="text" value="${esc(currentPlayer?.telegram_handle || "")}" placeholder="@handle" />
            </div>
            <div class="lb-profile-setting-row">
              <button type="button" id="lb-profile-save-btn" class="lb-discord-btn">${t("profileSaveBtn")}</button>
            </div>
            ${currentPassportUrl
              ? `<div class="lb-profile-setting-row">
                  <button type="button" id="lb-passport-unlink-settings" class="lb-gate-retry">${t("profilePassportUnlinkAction")}</button>
                </div>`
              : `<div class="lb-profile-setting-row">
                  <button type="button" id="lb-passport-link-settings" class="lb-mini-btn lb-profile-link-btn">${t("profilePassportLinkAction")}</button>
                </div>`}
            <div class="lb-profile-setting-row">
              <button type="button" id="lb-signout-settings" class="lb-signout-btn">${t("profileLogoutAction")}</button>
            </div>
          </div>
        </div>
      </div>`;
    renderProfileBannerPicker();
    document.querySelector("#lb-profile-edit-done")?.addEventListener("click", toggleProfileEdit);
    document.querySelector("#lb-profile-save-btn")?.addEventListener("click", async () => {
      const displayName = document.querySelector("#lb-profile-edit-display-name")?.value?.trim() || "";
      const bio = document.querySelector("#lb-profile-edit-bio")?.value?.trim() || "";
      const twitter = document.querySelector("#lb-profile-edit-twitter")?.value?.trim().replace(/^@/, "") || "";
      const instagram = document.querySelector("#lb-profile-edit-instagram")?.value?.trim().replace(/^@/, "") || "";
      const telegram = document.querySelector("#lb-profile-edit-telegram")?.value?.trim().replace(/^@/, "") || "";
      const { data, error } = await supabase.functions.invoke("discord-verify", {
        body: { action: "update_profile", display_name: displayName, bio, twitter_handle: twitter, instagram_handle: instagram, telegram_handle: telegram },
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });
      if (!error && data?.player) syncCurrentPlayer(data.player, currentPassportUrl);
      renderProfileSummary();
    });
    document.querySelector("#lb-signout-settings")?.addEventListener("click", () => {
      supabase.auth.signOut();
    });
    document.querySelector("#lb-passport-unlink-settings")?.addEventListener("click", async () => {
      if (!currentSession) return;
      const { data, error } = await supabase.functions.invoke("discord-verify", {
        body: { action: "unlink_passport" },
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });
      if (error || data?.error) return;
      syncCurrentPlayer(data?.player || currentPlayer, null);
      renderProfileAvatar();
      renderProfileSummary();
      renderPassportLink(null);
    });
    document.querySelector("#lb-passport-link-settings")?.addEventListener("click", () => {
      profileBannerPickerOpen = false;
      renderProfileEditBtn();
      renderProfileSummary();
    });
  }

  function renderPassportLink(url) {
    const el = document.querySelector("#lb-passport-link");
    if (!el) return;
    if (url) {
      el.innerHTML = `
        <div class="lb-passport-linked-row">
          <a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="lb-passport-linked">${t("passportLinked")}</a>
          <button type="button" id="lb-passport-unlink" class="lb-gate-retry">${t("passportUnlinkBtn")}</button>
        </div>`;
      document.querySelector("#lb-passport-unlink")?.addEventListener("click", async () => {
        if (!currentSession) return;
        const { data, error } = await supabase.functions.invoke("discord-verify", {
          body: { action: "unlink_passport" },
          headers: { Authorization: `Bearer ${currentSession.access_token}` },
        });
        if (error || data?.error) return;
        syncCurrentPlayer(data?.player || currentPlayer, null);
        renderProfileAvatar();
        renderProfileSummary();
        renderPassportLink(null);
      });
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
      const effectivePassportUrl = data?.stellar_passport_url || selectedUrl;
      console.log("[TIERLY DEBUG] passport link response:", JSON.stringify({ hasPlayer: !!data?.player, playerKeys: data?.player ? Object.keys(data.player) : [], bio: data?.player?.bio, twitter: data?.player?.twitter_handle, telegram: data?.player?.telegram_handle, discord: data?.player?.discord_handle, instagram: data?.player?.instagram_handle }));
      syncCurrentPlayer(data?.player || currentPlayer, effectivePassportUrl);
      renderProfileAvatar();
      renderProfileSummary();
      renderPassportLink(effectivePassportUrl);
    });
  }

  async function checkDiscordMembership(session) {
    profileSyncState = "loading";
    profileSyncError = "";
    let ptr;
    try {
      ptr = await supabase.functions.invoke("discord-verify", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    } catch (invokeError) {
      ptr = { data: null, error: invokeError };
    }
    const { data, error } = ptr;
    console.log("[TIERLY DEBUG] discord-verify response:", JSON.stringify({ verified: data?.verified, hasPlayer: !!data?.player, playerKeys: data?.player ? Object.keys(data.player) : [], bio: data?.player?.bio, twitter: data?.player?.twitter_handle, telegram: data?.player?.telegram_handle, discord: data?.player?.discord_handle, instagram: data?.player?.instagram_handle, stellar_passport_url: data?.stellar_passport_url, error }));
    if (error || !data?.player) {
      console.error("[TIERLY] discord-verify failed:", error?.message || data?.error || "sin respuesta");
      profileSyncError = data?.error || error?.message || "";
      profileSyncState = currentPlayer ? "ready" : "error";
    } else {
      profileSyncState = "ready";
    }
    syncCurrentPlayer(data?.player || currentPlayer, data?.stellar_passport_url || currentPassportUrl);
    if (!data?.player?.banner && localStorage.getItem("tellus-profile-banner")) {
      // Banner was picked in localStorage before this login (or while logged
      // out), so persistBannerToServer() no-opped back then. Push it now.
      persistBannerToServer();
    }
    console.log("[TIERLY DEBUG] currentPlayer after sync:", JSON.stringify({ bio: currentPlayer?.bio, twitter: currentPlayer?.twitter_handle, telegram: currentPlayer?.telegram_handle, discord: currentPlayer?.discord_handle, instagram: currentPlayer?.instagram_handle, stellar_passport_url: currentPlayer?.stellar_passport_url }));
    renderProfileAvatar();
    renderProfileSummary();
    renderProfileStats();
    renderProfileHistory();
  }

  function renderAuth(session) {
    currentSession = session;
    const el = document.querySelector("#lb-auth");
    if (!el) return;
    if (!session) {
      currentPlayer = null;
      profileSyncState = "idle";
      profileSyncError = "";
      renderProfileAvatar();
      renderProfileSummary();
      el.innerHTML = `<button id="lb-discord-login" class="lb-discord-btn">${t("loginDiscord")}</button>`;
      document.querySelector("#lb-discord-login").addEventListener("click", () => {
        supabase.auth.signInWithOAuth({ provider: "discord", options: { redirectTo: `${window.location.origin}/tierly` } });
      });
      renderProfileStats();
      renderProfileHistory();
      return;
    }
    renderProfileAvatar();
    renderProfileSummary();
    el.innerHTML = "";
    checkDiscordMembership(session);
    renderProfileStats();
    renderProfileHistory();
  }

  async function initAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    renderAuth(session);
    supabase.auth.onAuthStateChange((event, newSession) => {
      // INITIAL_SESSION duplicates the getSession() call above; TOKEN_REFRESHED
      // fires silently on token renewal. We don't wipe an open edit panel for
      // it, but if the first sync failed (e.g. stale token → 401) the renewed
      // token is exactly when we should retry.
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
        currentSession = newSession;
        if (newSession && profileSyncState === "error") checkDiscordMembership(newSession);
        return;
      }
      renderAuth(newSession);
    });
  }

  function switchView(view) {
    activeView = view;
    document.querySelectorAll(".lb-view").forEach((section) => { section.hidden = section.dataset.view !== view; });
    document.querySelectorAll(".lb-nav-item").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.view === view));
    if (view !== "player" && location.hash.startsWith("#u/")) history.replaceState(null, "", location.pathname + location.search);
  }

  function renderNav() {
    const el = document.querySelector("#lb-nav");
    if (!el) return;
    el.innerHTML = `
      <button class="lb-nav-item${activeView === "ranking" ? " is-active" : ""}" data-view="ranking"><i data-lucide="trophy"></i><span>${t("navRanking")}</span></button>
      <button class="lb-nav-item${activeView === "bracket" ? " is-active" : ""}" data-view="bracket"><i data-lucide="calendar-days"></i><span>${t("navBracket")}</span></button>
      <button class="lb-nav-item${activeView === "rewards" ? " is-active" : ""}" data-view="rewards"><i data-lucide="gift"></i><span>${t("navRewards")}</span></button>
      <button class="lb-nav-item${activeView === "chess" ? " is-active" : ""}" data-view="chess"><i data-lucide="swords"></i><span>${t("navChess")}</span></button>
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

  function sanitizeSearchTerm(query) {
    const term = String(query ?? "").replace(/[,()%_*"'\\]/g, "").replace(/\s+/g, " ").trim();
    return term.length < 2 ? "" : term;
  }

  async function searchPlayers(query) {
    const token = ++playerSearchToken;
    const term = sanitizeSearchTerm(query);
    if (!term) {
      playerSearchRows = [];
      playerSearchLoading = false;
      renderRankingRows();
      return;
    }
    playerSearchLoading = true;
    try {
      const { data, error } = await supabase
        .from("leaderboard_public_view")
        .select("*")
        .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
        .order("total_points", { ascending: false })
        .limit(20);
      if (token !== playerSearchToken) return;
      playerSearchRows = error || !data ? [] : data;
    } catch {
      if (token !== playerSearchToken) return;
      playerSearchRows = [];
    }
    playerSearchLoading = false;
    renderRankingRows();
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
  let rankSearchBound = false;
  function renderRankSearch() {
    const input = document.querySelector("#lb-player-search");
    if (!input) return;
    input.placeholder = t("searchPlaceholder");
    if (rankSearchBound) return;
    rankSearchBound = true;
    input.addEventListener("input", () => {
      rankingSearch = input.value;
      document.querySelector("#lb-rank-tabs").hidden = rankingSearch.trim().length > 0;
      renderRankingRows();
      clearTimeout(passportSearchTimer);
      passportSearchTimer = setTimeout(() => searchPassportBuilders(rankingSearch), 300);
      clearTimeout(playerSearchTimer);
      playerSearchTimer = setTimeout(() => searchPlayers(rankingSearch), 300);
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

  const PROFILE_BANNERS = [
    "banner-01.gif", "banner-02.jpg", "banner-03.jpg", "banner-04.jpg",
    "banner-05.jpg", "banner-06.jpg", "banner-07.jpg", "banner-08.gif",
    "banner-09.gif", "banner-10.gif", "banner-11.gif", "banner-12.jpg",
    "1041uuu.gif", "1041uuu(1).gif", "1050464681824327735.jpg",
    "1063905111962783520.jpg", "1116048351422837854.jpg",
    "1148347605017160795.jpg", "169448004726296465.gif",
    "16_9 Pixel Park Wallpaper.jpg", "211174978558689.gif",
    "27092035258192589.gif", "3025924747067433.gif",
    "338614465758662667.gif", "49187820924538146.gif",
    "55098795472341775.gif", "643662971732698884.jpg",
    "743164376055979170.jpg", "748230925569879988.gif",
    "804948133423665237.jpg", "831266043736324624.gif",
    "831266043736324714.gif", "831266043736324774.gif",
    "831266043738129974.gif", "919930661408174115.jpg",
    "991847517907012596.jpg", "Chinju Forest.jpg", "KIROKAZE.gif",
    "Khum biết tên là gì🌱.jpg", "Post by @anasabdin · 1 image.gif",
    "Post by @waneella · 1 image.gif",
    "Post de Instagram noticias de periodismo profesional informativo azul oscuro.png",
    "Search_ pixel art gif _ mini-moss.gif", "WANEELLA pixel art.gif",
    "Waneella, New Specimen.jpg", "mejwh.gif", "mejwh(1).gif",
    "minimoss.gif", "𝑷𝒊𝒏𝒕𝒆𝒓𝒆𝒔𝒕_ 𝒉𝒐𝒏𝒆𝒆𝒚𝒋𝒊𝒏 ❀.gif",
  ];
  let profileBanner = localStorage.getItem("tellus-profile-banner") || PROFILE_BANNERS[0];
  let profileBannerPickerOpen = false;
  let bannerCarouselOffset = 0;
  let profileBannerFit = { tx: 0, ty: 0, zoom: 100 };
  try {
    const savedFit = JSON.parse(localStorage.getItem("tellus-profile-banner-fit-v2") || "null");
    if (savedFit && typeof savedFit === "object") {
      profileBannerFit = {
        tx: Number.isFinite(savedFit.tx) ? savedFit.tx : 0,
        ty: Number.isFinite(savedFit.ty) ? savedFit.ty : 0,
        zoom: Number.isFinite(savedFit.zoom) ? savedFit.zoom : 100,
      };
    }
  } catch {
    // Ignore corrupt localStorage value — defaults already set above.
  }

  function saveBannerFit() {
    localStorage.setItem("tellus-profile-banner-fit-v2", JSON.stringify(profileBannerFit));
  }

  async function persistBannerToServer() {
    if (!currentSession) return;
    const { data, error } = await supabase.functions.invoke("discord-verify", {
      body: { action: "update_profile", banner: profileBanner, banner_fit: profileBannerFit },
      headers: { Authorization: `Bearer ${currentSession.access_token}` },
    });
    if (!error && data?.player) syncCurrentPlayer(data.player, currentPassportUrl);
  }

  function bannerFitTransform(fit) {
    return `translate(${fit.tx}%, ${fit.ty}%) scale(${fit.zoom / 100})`;
  }

  function applyBannerFitStyle() {
    const img = document.querySelector("#lb-profile-banner-img");
    if (!img) return;
    img.style.transform = bannerFitTransform(profileBannerFit);
  }

  function renderProfileBanner() {
    const img = document.querySelector("#lb-profile-banner-img");
    if (!img) return;
    img.src = `/tierly/banners/${profileBanner}`;
    applyBannerFitStyle();
  }

  let cropWorkingFit = { tx: 0, ty: 0, zoom: 100 };
  let cropDrag = null;

  function cropZoomLimit(fit) {
    return Math.max(0, (fit.zoom - 100) / 2);
  }

  function clampCropFit(fit) {
    const limit = cropZoomLimit(fit);
    return {
      zoom: fit.zoom,
      tx: Math.max(-limit, Math.min(limit, fit.tx)),
      ty: Math.max(-limit, Math.min(limit, fit.ty)),
    };
  }

  function applyCropModalStyle() {
    const img = document.querySelector("#lb-crop-frame-img");
    if (img) img.style.transform = bannerFitTransform(cropWorkingFit);
    const label = document.querySelector("#lb-crop-zoom-label");
    if (label) label.textContent = `${cropWorkingFit.zoom}%`;
    document.querySelector("#lb-crop-zoom-out")?.toggleAttribute("disabled", cropWorkingFit.zoom <= 100);
    document.querySelector("#lb-crop-zoom-in")?.toggleAttribute("disabled", cropWorkingFit.zoom >= 300);
  }

  function openBannerCropModal() {
    cropWorkingFit = { ...profileBannerFit };
    const modal = document.querySelector("#lb-crop-modal");
    const img = document.querySelector("#lb-crop-frame-img");
    if (!modal || !img) return;
    img.src = `/tierly/banners/${profileBanner}`;
    applyCropModalStyle();
    modal.showModal();
  }

  function initBannerCropModal() {
    const modal = document.querySelector("#lb-crop-modal");
    const frame = document.querySelector("#lb-crop-frame");
    if (!modal || !frame) return;
    document.querySelector("#lb-crop-modal-title").textContent = t("bannerAdjustTitle");
    document.querySelector("#lb-crop-modal-cancel").textContent = t("bannerAdjustCancel");
    document.querySelector("#lb-crop-modal-apply").textContent = t("bannerAdjustApply");
    document.querySelector("#lb-crop-modal-close").addEventListener("click", () => modal.close());
    document.querySelector("#lb-crop-modal-cancel").addEventListener("click", () => modal.close());
    modal.addEventListener("click", (e) => { if (e.target.id === "lb-crop-modal") modal.close(); });
    document.querySelector("#lb-crop-modal-apply").addEventListener("click", () => {
      profileBannerFit = clampCropFit(cropWorkingFit);
      saveBannerFit();
      applyBannerFitStyle();
      persistBannerToServer();
      modal.close();
    });
    document.querySelector("#lb-crop-zoom-out").addEventListener("click", () => {
      cropWorkingFit = clampCropFit({ ...cropWorkingFit, zoom: Math.max(100, cropWorkingFit.zoom - 10) });
      applyCropModalStyle();
    });
    document.querySelector("#lb-crop-zoom-in").addEventListener("click", () => {
      cropWorkingFit = clampCropFit({ ...cropWorkingFit, zoom: Math.min(300, cropWorkingFit.zoom + 10) });
      applyCropModalStyle();
    });
    frame.addEventListener("pointerdown", (e) => {
      frame.setPointerCapture(e.pointerId);
      frame.classList.add("is-dragging");
      cropDrag = { startX: e.clientX, startY: e.clientY, startTx: cropWorkingFit.tx, startTy: cropWorkingFit.ty };
    });
    frame.addEventListener("pointermove", (e) => {
      if (!cropDrag) return;
      const rect = frame.getBoundingClientRect();
      const dxPct = ((e.clientX - cropDrag.startX) / rect.width) * 100;
      const dyPct = ((e.clientY - cropDrag.startY) / rect.height) * 100;
      cropWorkingFit = clampCropFit({
        zoom: cropWorkingFit.zoom,
        tx: cropDrag.startTx + dxPct,
        ty: cropDrag.startTy + dyPct,
      });
      applyCropModalStyle();
    });
    const endDrag = () => { cropDrag = null; frame.classList.remove("is-dragging"); };
    frame.addEventListener("pointerup", endDrag);
    frame.addEventListener("pointercancel", endDrag);
  }

  function renderProfileBannerPicker() {
    const picker = document.querySelector("#lb-profile-banner-picker");
    if (!picker) return;
    const visibleCount = 6;
    const total = PROFILE_BANNERS.length;
    const maxOffset = Math.max(0, total - visibleCount);
    if (bannerCarouselOffset > maxOffset) bannerCarouselOffset = maxOffset;
    const visible = PROFILE_BANNERS.slice(bannerCarouselOffset, bannerCarouselOffset + visibleCount);
    picker.innerHTML = `
      <div class="lb-banner-carousel">
        <button type="button" class="lb-banner-carousel-arrow lb-banner-carousel-prev" ${bannerCarouselOffset === 0 ? "disabled" : ""} aria-label="Previous">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div class="lb-banner-carousel-track">
          ${visible.map((file) => `
            <button type="button" class="lb-profile-banner-option ${file === profileBanner ? "is-active" : ""}"
              data-banner="${file}" style="background-image: url('/tierly/banners/${file}')" aria-label="${file}"></button>
          `).join("")}
        </div>
        <button type="button" class="lb-banner-carousel-arrow lb-banner-carousel-next" ${bannerCarouselOffset >= maxOffset ? "disabled" : ""} aria-label="Next">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>`;
    picker.querySelectorAll("[data-banner]").forEach((btn) => {
      btn.addEventListener("click", () => {
        profileBanner = btn.dataset.banner;
        localStorage.setItem("tellus-profile-banner", profileBanner);
        profileBannerFit = { tx: 0, ty: 0, zoom: 100 };
        saveBannerFit();
        renderProfileBanner();
        renderProfileBannerPicker();
        persistBannerToServer();
      });
    });
    picker.querySelector(".lb-banner-carousel-prev")?.addEventListener("click", () => {
      if (bannerCarouselOffset > 0) { bannerCarouselOffset--; renderProfileBannerPicker(); }
    });
    picker.querySelector(".lb-banner-carousel-next")?.addEventListener("click", () => {
      if (bannerCarouselOffset < maxOffset) { bannerCarouselOffset++; renderProfileBannerPicker(); }
    });
    document.querySelector("#lb-profile-banner-adjust-btn")?.addEventListener("click", openBannerCropModal);
  }

  function renderProfileEditBtn() {
    const btn = document.querySelector("#lb-profile-edit-btn");
    if (btn) btn.textContent = t(profileBannerPickerOpen ? "profileEditBtnClose" : "profileEditBtn");
  }

  function toggleProfileEdit() {
    profileBannerPickerOpen = !profileBannerPickerOpen;
    renderProfileSummary();
  }

  const SEASON_ANCHOR = new Date(Date.UTC(2026, 7, 27));
  function currentSeasonEnd() {
    const now = new Date();
    let monthsSinceAnchor = (now.getUTCFullYear() - SEASON_ANCHOR.getUTCFullYear()) * 12
      + (now.getUTCMonth() - SEASON_ANCHOR.getUTCMonth());
    if (now.getUTCDate() < SEASON_ANCHOR.getUTCDate()) monthsSinceAnchor -= 1;
    const seasonIndex = Math.floor(Math.max(monthsSinceAnchor, 0) / 6);
    const start = new Date(SEASON_ANCHOR);
    start.setUTCMonth(start.getUTCMonth() + seasonIndex * 6);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 6);
    return end;
  }

  function renderStaticText() {
    document.querySelector("#lb-ranking-title").textContent = t("rankingTitle");
    const seasonNoteEl = document.querySelector("#lb-season-note");
    if (seasonNoteEl) {
      const dateLabel = currentSeasonEnd().toLocaleDateString(lang === "es" ? "es-AR" : "en-US", { year: "numeric", month: "long", day: "numeric" });
      seasonNoteEl.textContent = t("seasonResetsOn").replace("{date}", dateLabel);
    }
    document.querySelector("#lb-bracket-title").textContent = t("bracketTitle");
    document.querySelector("#lb-rewards-title").textContent = t("rewardsTitle");
    document.querySelector("#lb-profile-title").textContent = t("profileTitle");
    document.querySelector("#lb-profile-history-title").textContent = t("profileHistoryTitle");
    document.querySelector("#lb-settings-title").textContent = t("settingsTitle");
    document.querySelector("#lb-view-full").textContent = t("viewFull") + " →";
    document.querySelector("#lb-ranks-info-btn-label").textContent = t("ranksInfoBtn");
    document.querySelector("#lb-sidebar-promo-text").textContent = t("promoSidebar");
    document.querySelector("#lb-upcoming-title").textContent = t("upcomingEventsTitle");
    document.querySelector("#lb-activity-title").textContent = t("recentActivityTitle");
    document.querySelector("#lb-player-back-label").textContent = t("playerBackBtn");
    renderProfileEditBtn();
    renderProfileSummary();
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
    renderStats();
    renderProfileStats();
    renderProfileHistory();
    renderRanksModal();
    loadRanking();
    loadLatestBracket();
    loadRewards();
  }

  document.querySelector("#lb-view-full").addEventListener("click", () => {
    rankingLimit = 50;
    renderRankTabs();
    renderRankingRows();
  });

  document.querySelector("#lb-ranks-info-btn").addEventListener("click", () => {
    document.querySelector("#lb-ranks-modal").showModal();
  });
  document.querySelector("#lb-ranks-modal-close").addEventListener("click", () => {
    document.querySelector("#lb-ranks-modal").close();
  });
  document.querySelector("#lb-ranks-modal").addEventListener("click", (e) => {
    if (e.target.id === "lb-ranks-modal") e.target.close();
  });

  document.querySelector("#lb-player-back-btn")?.addEventListener("click", () => switchView("ranking"));

  function handleHashRoute() {
    const match = /^#u\/(.+)$/.exec(location.hash);
    if (match) openPlayerProfile(decodeURIComponent(match[1]));
  }
  window.addEventListener("hashchange", handleHashRoute);

  renderStaticText();
  renderProfileBanner();
  initBannerCropModal();
  renderRanksModal();
  renderNav();
  renderRankTabs();
  renderRankSearch();
  renderSettingsView();
  renderFooter();
  switchView("ranking");

  initAuth();

  const rankingPromise = loadRanking();
  const bracketPromise = loadLatestBracket();
  const rewardsPromise = loadRewards();
  Promise.all([rankingPromise, bracketPromise, rewardsPromise]).then(() => {
    renderStats();
    renderProfileStats();
    renderProfileHistory();
    handleHashRoute();
  });
})();
