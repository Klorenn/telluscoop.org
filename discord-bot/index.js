import { Client, GatewayIntentBits, ChannelType, ActivityType } from "discord.js";
import { createClient } from "@supabase/supabase-js";
import { rankForPoints } from "../tierly/ranks.mjs";

const {
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
  WELCOME_CHANNEL_ID,
  ANNOUNCE_CHANNEL_ID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

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
    topic: "Anuncios automáticos del leaderboard gaming de Tellus 🐈‍⬛ — nuevos eventos y subidas de rango.",
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
      `🐈‍⬛ **Nuevo evento:** ${event.name}${event.event_date ? ` — ${event.event_date}` : ""}\n${LEADERBOARD_URL}`,
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
    await channel.send(`🎉 <@${player.discord_id}> subió a **${label}** en el leaderboard de Tellus! ${LEADERBOARD_URL}`);
    await supabase.from("gaming_players").update({ last_notified_rank_min: rank.min }).eq("id", player.id);
  }
}

async function runNotificationPoll(guild) {
  if (!supabase) return;
  const channel = await getAnnounceChannel(guild);
  await announceNewEvents(channel);
  await announceRankUps(channel);
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
  if (message.content.trim().toLowerCase() !== "!bienvenida") return;

  await message.channel
    .send(`🐈‍⬛ ¡Bienvenido/a, ${message.member}! Sumate al leaderboard gaming de Tellus → ${LEADERBOARD_URL}`)
    .catch((err) => console.error("No se pudo postear bienvenida:", err.message));
  await syncMembership(message.member);
});

client.login(DISCORD_BOT_TOKEN);
