import { Client, GatewayIntentBits, ChannelType, ActivityType } from "discord.js";
import { createClient } from "@supabase/supabase-js";
import { rankForPoints } from "../tierly/ranks.mjs";
import { playingGames, presenceDelta } from "./presence-delta.mjs";
import { createSessionStore } from "./session-store.mjs";

const {
  DISCORD_BOT_TOKEN: DISCORD_BOT_TOKEN_ENV,
  DISCORD_TOKEN,
  DISCORD_GUILD_ID,
  WELCOME_CHANNEL_ID,
  ANNOUNCE_CHANNEL_ID,
  SUPABASE_URL: SUPABASE_URL_ENV,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

const DISCORD_BOT_TOKEN = DISCORD_BOT_TOKEN_ENV || DISCORD_TOKEN;
const SUPABASE_URL = SUPABASE_URL_ENV || NEXT_PUBLIC_SUPABASE_URL;

if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID) {
  throw new Error("Faltan DISCORD_BOT_TOKEN o DISCORD_GUILD_ID en las variables de entorno");
}

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

const WELCOME_CHANNEL_NAME = "bienvenida-tierly";
const ANNOUNCE_CHANNEL_NAME = "anuncios-tierly";
const LEADERBOARD_URL = "https://telluscoop.org/tierly";
const POLL_INTERVAL_MS = 5 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;
const CONSENT_VERSION = "1";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
  ],
});

const sessions = supabase ? createSessionStore(supabase) : null;
const activeSessions = new Map();

function sessionKey(userId, gameName) {
  return `${userId}:${gameName}`;
}

async function handleTierlyCommand(message) {
  const parts = message.content.trim().toLowerCase().split(/\s+/);
  if (parts[0] !== "!tierly" || parts[1] !== "presencia" && parts[1] !== "borrar") return false;
  if (!sessions) {
    await message.channel.send("El servicio de consentimiento no está disponible en este momento.");
    return true;
  }

  try {
    if (parts[1] === "presencia" && parts[2] === "si") {
      await sessions.acceptMemberConsent(DISCORD_GUILD_ID, message.author.id, CONSENT_VERSION);
      await message.channel.send("Consentimiento de presencia activado. Tierly podrá registrar las sesiones de juego.");
    } else if (parts[1] === "presencia" && parts[2] === "no") {
      await sessions.declineMemberConsent(DISCORD_GUILD_ID, message.author.id);
      for (const [key, sessionId] of activeSessions) {
        if (key.startsWith(`${message.author.id}:`)) activeSessions.delete(key);
      }
      await message.channel.send("Consentimiento de presencia retirado. Las sesiones abiertas se cerraron y no se registrarán nuevas sesiones.");
    } else if (parts[1] === "borrar" && parts.length === 2) {
      await sessions.requestMemberDeletion(DISCORD_GUILD_ID, message.author.id);
      for (const [key, sessionId] of activeSessions) {
        if (key.startsWith(`${message.author.id}:`)) activeSessions.delete(key);
      }
      await message.channel.send("Se solicitó el borrado de tus datos de Tierly y se cerraron tus sesiones.");
    } else {
      await message.channel.send("Usa: `!tierly presencia si`, `!tierly presencia no` o `!tierly borrar`.");
    }
  } catch (error) {
    console.error("No se pudo actualizar el consentimiento de Tierly.");
    await message.channel.send("No se pudo actualizar el consentimiento. Inténtalo nuevamente más tarde.");
  }
  return true;
}

function memberIdentity(member) {
  const user = member?.user;
  const avatarHash = user?.avatar;
  return {
    displayName: user?.globalName || user?.username || member?.displayName || "Jugador",
    avatarUrl: avatarHash
      ? `https://cdn.discordapp.com/avatars/${member.id}/${avatarHash}.${avatarHash.startsWith("a_") ? "gif" : "png"}`
      : null,
  };
}

async function handlePresenceUpdate(oldPresence, newPresence) {
  if (!sessions) return;
  const guildId = newPresence?.guild?.id || oldPresence?.guild?.id;
  if (guildId !== DISCORD_GUILD_ID) return;
  if (newPresence?.member?.user?.bot) return;
  const settings = await sessions.getCommunitySettings(guildId);
  if (settings?.presence_enabled === false) return;

  const userId = newPresence?.userId || oldPresence?.userId;
  if (!userId) return;
  const { started, stopped } = presenceDelta(oldPresence, newPresence);

  for (const gameName of started) {
    try {
      const gameId = await sessions.resolveGame(gameName);
      const identity = memberIdentity(newPresence.member);
      const session = await sessions.openSession({
        guildId: DISCORD_GUILD_ID,
        communityName: newPresence.guild?.name,
        discordUserId: userId,
        gameId,
        ...identity,
      });
      if (session?.id) activeSessions.set(sessionKey(userId, gameName), session.id);
    } catch (error) {
      console.error("No se pudo abrir la sesion de presence.");
    }
  }
  for (const gameName of stopped) {
    try {
      const key = sessionKey(userId, gameName);
      const sessionId = activeSessions.get(key);
      if (!sessionId) continue;
      await sessions.closeSession(sessionId, undefined, "normal");
      activeSessions.delete(key);
    } catch (error) {
      console.error("No se pudo cerrar la sesion de presence.");
    }
  }
}

async function reconcilePresence(guild) {
  const settings = await sessions.getCommunitySettings(DISCORD_GUILD_ID);
  if (settings?.presence_enabled === false) return;
  for (const member of guild.members.cache.values()) {
    if (member.user?.bot) continue;
    for (const gameName of playingGames(member.presence)) {
      const gameId = await sessions.resolveGame(gameName);
      const identity = memberIdentity(member);
      const session = await sessions.openSession({
        guildId: DISCORD_GUILD_ID,
        discordUserId: member.id,
        gameId,
        ...identity,
      });
      if (session?.id) activeSessions.set(sessionKey(member.id, gameName), session.id);
    }
  }
}

async function runPresenceHeartbeat() {
  const heartbeatAt = new Date().toISOString();
  for (const sessionId of activeSessions.values()) {
    try {
      await sessions.heartbeatSession(sessionId, heartbeatAt);
    } catch (error) {
      console.error("No se pudo actualizar un heartbeat.");
    }
  }
  try {
    const settings = await sessions.getCommunitySettings(DISCORD_GUILD_ID);
    const staleHours = Number(settings?.stale_session_hours) || 12;
    await sessions.closeStaleSessions({
      guildId: DISCORD_GUILD_ID,
      before: new Date(Date.now() - staleHours * 60 * 60 * 1000).toISOString(),
      endedAt: heartbeatAt,
    });
  } catch (error) {
    console.error("No se pudo cerrar sesiones obsoletas.");
  }
}

async function getWelcomeChannel(guild) {
  if (WELCOME_CHANNEL_ID) {
    const configured = await guild.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
    if (configured) return configured;
  }
  const existing = guild.channels.cache.find(
    (c) => c.name === WELCOME_CHANNEL_NAME && c.type === ChannelType.GuildText,
  );
  if (existing) return existing;
  return guild.channels.create({
    name: WELCOME_CHANNEL_NAME,
    type: ChannelType.GuildText,
    topic: "Tierly saluda por acá 🐈‍⬛ — bot de verificación del leaderboard gaming de Tellus.",
  });
}

async function getAnnounceChannel(guild) {
  if (ANNOUNCE_CHANNEL_ID) {
    const configured = await guild.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);
    if (configured) return configured;
  }
  const existing = guild.channels.cache.find(
    (c) => c.name === ANNOUNCE_CHANNEL_NAME && c.type === ChannelType.GuildText,
  );
  if (existing) return existing;
  return guild.channels.create({
    name: ANNOUNCE_CHANNEL_NAME,
    type: ChannelType.GuildText,
    topic: "Tellus gaming leaderboard updates 🐈‍⬛ — new events and rank-ups.",
  });
}

// Anuncia eventos nuevos y subidas de rango una sola vez cada uno. Corre cada
// POLL_INTERVAL_MS porque el bot no tiene forma de enterarse en tiempo real de
// cambios hechos desde el panel admin (no hay webhook/trigger hacia acá).
async function announceNewEvents(channel) {
  const { data: events, error: eventsError } = await supabase
    .from("gaming_events")
    .select("id, name, event_date")
    .order("event_date", { ascending: false })
    .limit(50);
  if (eventsError || !events) return;

  const { data: notified, error: notifiedError } = await supabase
    .from("gaming_bot_notifications")
    .select("ref_id")
    .eq("kind", "event");
  if (notifiedError) return;
  const notifiedIds = new Set((notified || []).map((n) => n.ref_id));

  // Primer arranque de este feature: no hay nada anunciado todavía. Sembramos
  // los eventos existentes como "ya anunciados" en vez de spamear el historial.
  if (notifiedIds.size === 0 && events.length > 0) {
    await supabase.from("gaming_bot_notifications").insert(
      events.map((e) => ({ kind: "event", ref_id: e.id })),
    );
    return;
  }

  for (const event of events) {
    if (notifiedIds.has(event.id)) continue;
    await channel.send(
      `🐈‍⬛ New event: **${event.name}**${event.event_date ? ` — ${event.event_date}` : ""}\n${LEADERBOARD_URL}`,
    );
    await supabase.from("gaming_bot_notifications").insert({ kind: "event", ref_id: event.id });
  }
}

async function announceRankUps(channel) {
  const { data: ranking, error: rankingError } = await supabase
    .from("leaderboard_public_view")
    .select("player_id, total_points, discord_member")
    .eq("discord_member", true);
  if (rankingError || !ranking) return;

  const playerIds = ranking.map((r) => r.player_id);
  if (!playerIds.length) return;

  const { data: players, error: playersError } = await supabase
    .from("gaming_players")
    .select("id, discord_id, last_notified_rank_min")
    .in("id", playerIds);
  if (playersError || !players) return;
  const playerById = new Map(players.map((p) => [p.id, p]));

  for (const row of ranking) {
    const player = playerById.get(row.player_id);
    if (!player?.discord_id) continue;
    const rank = rankForPoints(row.total_points || 0);

    // Primera vez que vemos a este jugador: guardamos el rango actual como
    // línea de base, sin anunciar (si no, todos "suben de rango" el día 1).
    if (player.last_notified_rank_min === null) {
      await supabase.from("gaming_players").update({ last_notified_rank_min: rank.min }).eq("id", player.id);
      continue;
    }

    if (rank.min <= player.last_notified_rank_min) continue; // igual o bajó (ej. reset de temporada) — no se anuncia
    const label = `${rank.tierId} ${rank.division}`;
    await channel.send(`🎉 <@${player.discord_id}> ranked up to **${label}**! ${LEADERBOARD_URL}`);
    await supabase.from("gaming_players").update({ last_notified_rank_min: rank.min }).eq("id", player.id);
  }
}

async function runNotificationPoll(guild) {
  if (!supabase) return;
  const channel = await getAnnounceChannel(guild);
  await deliverEventReminders(channel);
  await announceNewEvents(channel);
  await announceRankUps(channel);
}

async function deliverEventReminders(channel) {
  const now = new Date().toISOString();
  const { data: reminders, error } = await supabase
    .from("tierly_event_notifications")
    .select("id, event_id, reminder_minutes, scheduled_for, gaming_events(name, starts_at, timezone)")
    .eq("guild_id", DISCORD_GUILD_ID)
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(25);
  if (error || !reminders) return;

  for (const reminder of reminders) {
    const event = reminder.gaming_events;
    if (!event) continue;
    const { data: claimed, error: claimError } = await supabase
      .from("tierly_event_notifications")
      .update({ status: "sent", sent_at: now })
      .eq("id", reminder.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (claimError || !claimed) continue;
    await channel.send(
      `⏰ Recordatorio: **${event.name}** comienza en ${reminder.reminder_minutes} minutos (${event.timezone || "UTC"}).\n${LEADERBOARD_URL}`,
    );
  }
}

async function syncMembership(member) {
  if (!supabase) return;
  const avatarHash = member.user.avatar;
  const avatarUrl = avatarHash
    ? `https://cdn.discordapp.com/avatars/${member.id}/${avatarHash}.${avatarHash.startsWith("a_") ? "gif" : "png"}`
    : null;
  const { error } = await supabase.from("gaming_players").upsert(
    {
      discord_id: member.id,
      display_name: member.user.globalName || member.user.username,
      avatar_url: avatarUrl,
      discord_member: true,
      discord_verified_at: new Date().toISOString(),
    },
    { onConflict: "discord_id" },
  );
  if (error) console.error("No se pudo sincronizar gaming_players:", error.message);
}

client.once("ready", async () => {
  console.log(`Tierly conectado como ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "el ranking gaming de Tellus", type: ActivityType.Watching }],
    status: "online",
  });

  const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
  const channel = await getWelcomeChannel(guild);
  await channel
    .send(`🐈‍⬛ **Tierly está en línea.** Ya puedo verificar membresías para el leaderboard → ${LEADERBOARD_URL}`)
    .catch((err) => console.error("No se pudo postear saludo de arranque:", err.message));

  if (supabase) {
    await runNotificationPoll(guild).catch((err) => console.error("Fallo el poll de notificaciones:", err.message));
    setInterval(() => {
      runNotificationPoll(guild).catch((err) => console.error("Fallo el poll de notificaciones:", err.message));
    }, POLL_INTERVAL_MS);
  }

  if (sessions) {
    await sessions.ensureCommunity({ guildId: DISCORD_GUILD_ID, name: guild.name })
      .catch((err) => console.error("Fallo el bootstrap de la comunidad:", err.message));
    await sessions.reconcileOpenSessions({ guildId: DISCORD_GUILD_ID, reason: "crash" })
      .catch((err) => console.error("Fallo la reconciliacion inicial:", err.message));
    await reconcilePresence(guild)
      .catch((err) => console.error("Fallo la reconciliacion de presence:", err.message));
    setInterval(() => {
      runPresenceHeartbeat().catch((err) => console.error("Fallo el heartbeat de presence:", err.message));
    }, HEARTBEAT_INTERVAL_MS);
  }
});

client.on("presenceUpdate", (oldPresence, newPresence) => {
  handlePresenceUpdate(oldPresence, newPresence)
    .catch((err) => console.error("Fallo al registrar sesion de presence:", err.message));
});

client.on("guildMemberAdd", async (member) => {
  if (member.guild.id !== DISCORD_GUILD_ID) return;
  const channel = await getWelcomeChannel(member.guild);
  await channel
    .send(`🐈‍⬛ ¡Bienvenido/a, ${member}! Sumate al leaderboard gaming de Tellus → ${LEADERBOARD_URL}`)
    .catch((err) => console.error("No se pudo postear bienvenida:", err.message));
  await syncMembership(member);
});

// Comando manual para gente que ya era miembro del server antes de que el bot
// arrancara — guildMemberAdd no dispara retroactivamente para esos casos.
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.guild?.id !== DISCORD_GUILD_ID) return;
  if (await handleTierlyCommand(message)) return;
  if (message.content.trim().toLowerCase() !== "!bienvenida") return;

  await message.channel
    .send(`🐈‍⬛ ¡Bienvenido/a, ${message.member}! Sumate al leaderboard gaming de Tellus → ${LEADERBOARD_URL}`)
    .catch((err) => console.error("No se pudo postear bienvenida:", err.message));
  await syncMembership(message.member);
});

client.login(DISCORD_BOT_TOKEN);
