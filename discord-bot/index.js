import { Client, GatewayIntentBits, ChannelType, ActivityType } from "discord.js";
import { createClient } from "@supabase/supabase-js";

const {
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
  WELCOME_CHANNEL_ID,
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
const LEADERBOARD_URL = "https://telluscoop.org/tierly";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
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
  await channel.send(
    `🐈‍⬛ **Tierly está en línea.** Ya puedo verificar membresías para el leaderboard → ${LEADERBOARD_URL}`,
  );
});

client.on("guildMemberAdd", async (member) => {
  if (member.guild.id !== DISCORD_GUILD_ID) return;
  const channel = await getWelcomeChannel(member.guild);
  await channel.send(
    `🐈‍⬛ ¡Bienvenido/a, ${member}! Sumate al leaderboard gaming de Tellus → ${LEADERBOARD_URL}`,
  );
  await syncMembership(member);
});

client.login(DISCORD_BOT_TOKEN);
