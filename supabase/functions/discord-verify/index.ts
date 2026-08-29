import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://telluscoop.org", "https://www.telluscoop.org"];
const LOCAL_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1):\d+$/;

const isAllowedOrigin = (origin: string | null) =>
  Boolean(origin && (ALLOWED_ORIGINS.includes(origin) || LOCAL_ORIGIN.test(origin)));

const corsFor = (origin: string | null) => ({
  "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin! : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});

const VERIFY_TTL_MS = 10 * 60 * 1000;
const PASSPORT_API_BASE = "https://demo.stellarpassport.xyz/api/v1";
const PLAYER_SELECT = [
  "id",
  "display_name",
  "username",
  "avatar_url",
  "bio",
  "banner",
  "banner_fit",
  "twitter_handle",
  "telegram_handle",
  "discord_handle",
  "instagram_handle",
  "discord_member",
  "discord_verified_at",
  "stellar_passport_url",
  "stellar_passport_name",
  "stellar_passport_username",
  "stellar_passport_avatar_url",
  "stellar_passport_bio",
  "stellar_passport_role_title",
  "stellar_passport_tier",
  "stellar_passport_project_count",
  "stellar_passport_commits_30d",
  "stellar_passport_active_days_30d",
].join(", ");

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
}

async function generateUsername(admin: ReturnType<typeof createClient>, displayName: string | null, discordId: string): Promise<string> {
  const base = slugify(displayName || "") || `player-${discordId.slice(-6)}`;
  let candidate = base;
  for (let attempt = 0; attempt < 20; attempt++) {
    const { data } = await admin.from("gaming_players").select("id").eq("username", candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${Math.floor(Math.random() * 9000 + 1000)}`;
  }
  return `${base}-${discordId.slice(-6)}`;
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, maxLength) : null;
}

function cleanHandle(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/^@+/, "").replace(/\s+/g, "");
  return normalized ? normalized.slice(0, 64) : null;
}

function cleanBanner(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200) return null;
  if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) return null;
  return trimmed;
}

function cleanBannerFit(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const zoom = typeof raw.zoom === "number" && Number.isFinite(raw.zoom)
    ? Math.max(100, Math.min(300, raw.zoom))
    : 100;
  const limit = Math.max(0, (zoom - 100) / 2);
  const clampAxis = (n: unknown) => typeof n === "number" && Number.isFinite(n)
    ? Math.max(-limit, Math.min(limit, n))
    : 0;
  return { tx: clampAxis(raw.tx), ty: clampAxis(raw.ty), zoom };
}

function normalizePassportProfile(builderData: Record<string, any>, username: string) {
  const builder = builderData?.builder && typeof builderData.builder === "object"
    ? builderData.builder
    : builderData?.data && typeof builderData.data === "object"
    ? builderData.data
    : builderData;
  const stats = builderData?.stats || builderData?.data?.stats || builder?.stats || {};
  const projects = Array.isArray(builderData?.projects) ? builderData.projects : [];
  const passportName = cleanText(
    builder?.name ?? builder?.display_name ?? builder?.full_name ?? builder?.github_username ?? username,
    120,
  );
  const passportUsername = cleanText(builder?.username ?? builder?.github_username ?? username, 80);
  const passportAvatarUrl = cleanText(
    builder?.avatar_url ?? builder?.avatar ?? builder?.image ?? builder?.logo_url,
    500,
  );
  const passportBio = cleanText(builder?.bio ?? builder?.description, 1200);
  const passportRoleTitle = cleanText(builder?.role_title, 160);
  const passportTier = cleanText(builder?.scf_tier, 80);
  const projectsCount = Array.isArray(projects) ? projects.length : null;
  return {
    display_name: cleanText(builder?.display_name ?? builder?.name, 120),
    bio: passportBio,
    twitter_handle: cleanHandle(builder?.twitter_handle),
    telegram_handle: cleanHandle(builder?.telegram_handle),
    discord_handle: cleanHandle(builder?.discord_handle ?? builder?.discord_username),
    instagram_handle: cleanHandle(builder?.instagram_handle),
    stellar_passport_name: passportName,
    stellar_passport_username: passportUsername,
    stellar_passport_avatar_url: passportAvatarUrl,
    stellar_passport_bio: passportBio,
    stellar_passport_role_title: passportRoleTitle,
    stellar_passport_tier: passportTier,
    stellar_passport_project_count: Number.isInteger(projectsCount) ? projectsCount : null,
    stellar_passport_commits_30d: Number.isInteger(stats?.totalCommits30d) ? stats.totalCommits30d : null,
    stellar_passport_active_days_30d: Number.isInteger(stats?.activeDays30d) ? stats.activeDays30d : null,
  };
}

function buildResponse(player: Record<string, any> | null, verified: boolean) {
  return {
    verified,
    stellar_passport_url: player?.stellar_passport_url ?? null,
    stellar_passport_name: player?.stellar_passport_name ?? null,
    username: player?.username ?? null,
    player,
  };
}

Deno.serve(async (request) => {
  const cors = corsFor(request.headers.get("Origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) return json({ error: "Sesión requerida" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Sesión inválida" }, 401);

    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // No body — plain self-verification call.
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Admin-only: look up a walk-in player's Discord avatar by id, so staff
    // can back-fill a photo for someone who hasn't logged in yet themselves.
    if (body.action === "lookup_avatar" && typeof body.discord_id === "string") {
      const { data: membership } = await supabase
        .from("organization_members")
        .select("role")
        .eq("user_id", user.id)
        .neq("role", "viewer")
        .maybeSingle();
      if (!membership) return json({ error: "Solo staff puede buscar avatares" }, 403);

      const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
      const guildId = Deno.env.get("DISCORD_GUILD_ID");
      if (!botToken || !guildId) return json({ error: "Discord todavía no está configurado" }, 503);

      const memberResponse = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${body.discord_id}`,
        { headers: { Authorization: `Bot ${botToken}` } },
      );
      if (memberResponse.status === 404) return json({ avatar_url: null });
      if (!memberResponse.ok) return json({ error: "No se pudo buscar el avatar" }, 502);

      const member = await memberResponse.json();
      const avatarHash = member.user?.avatar as string | null;
      const avatarUrl = avatarHash
        ? `https://cdn.discordapp.com/avatars/${body.discord_id}/${avatarHash}.${avatarHash.startsWith("a_") ? "gif" : "png"}`
        : null;
      if (avatarUrl) await admin.from("gaming_players").update({ avatar_url: avatarUrl }).eq("discord_id", body.discord_id);
      return json({ avatar_url: avatarUrl });
    }

    const discordIdentity = user.identities?.find((i: { provider: string }) => i.provider === "discord");
    const discordId = discordIdentity?.identity_data?.provider_id ?? discordIdentity?.identity_data?.sub;
    if (!discordId) return json({ error: "Sesión sin identidad de Discord" }, 400);
    const avatarUrl = discordIdentity?.identity_data?.avatar_url
      ?? user.user_metadata?.avatar_url
      ?? user.user_metadata?.picture
      ?? null;
    const displayName = discordIdentity?.identity_data?.full_name ?? discordIdentity?.identity_data?.name ?? null;

    const { data: existingPlayer } = await admin
      .from("gaming_players")
      .select(PLAYER_SELECT)
      .eq("discord_id", discordId)
      .maybeSingle();
    const username = existingPlayer?.username ?? await generateUsername(admin, displayName, discordId);

    if (body.action === "update_profile") {
      const updates = {
        ...(body.display_name !== undefined ? { display_name: cleanText(body.display_name, 120) } : {}),
        ...(body.bio !== undefined ? { bio: cleanText(body.bio, 1200) } : {}),
        ...(body.twitter_handle !== undefined ? { twitter_handle: cleanHandle(body.twitter_handle) } : {}),
        ...(body.telegram_handle !== undefined ? { telegram_handle: cleanHandle(body.telegram_handle) } : {}),
        ...(body.discord_handle !== undefined ? { discord_handle: cleanHandle(body.discord_handle) } : {}),
        ...(body.instagram_handle !== undefined ? { instagram_handle: cleanHandle(body.instagram_handle) } : {}),
        ...(body.banner !== undefined ? { banner: cleanBanner(body.banner) } : {}),
        ...(body.banner_fit !== undefined ? { banner_fit: cleanBannerFit(body.banner_fit) } : {}),
      };
      const { data: player, error: profileError } = await admin
        .from("gaming_players")
        .upsert(
          {
            discord_id: discordId,
            username,
            ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
            ...updates,
          },
          { onConflict: "discord_id" },
        )
        .select(PLAYER_SELECT)
        .single();
      if (profileError) {
        console.error("gaming_players profile update failed", profileError);
        return json({ error: "No se pudo guardar el perfil" }, 500);
      }
      return json(buildResponse(player, player?.discord_member === true));
    }

    if (body.action === "unlink_passport") {
      const { data: player, error: unlinkError } = await admin
        .from("gaming_players")
        .upsert(
          {
            discord_id: discordId,
            username,
            ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
            stellar_passport_url: null,
            stellar_passport_name: null,
            stellar_passport_username: null,
            stellar_passport_avatar_url: null,
            stellar_passport_bio: null,
            stellar_passport_role_title: null,
            stellar_passport_tier: null,
            stellar_passport_project_count: null,
            stellar_passport_commits_30d: null,
            stellar_passport_active_days_30d: null,
            instagram_handle: null,
          },
          { onConflict: "discord_id" },
        )
        .select(PLAYER_SELECT)
        .single();
      if (unlinkError) {
        console.error("gaming_players passport unlink failed", unlinkError);
        return json({ error: "No se pudo desvincular el perfil" }, 500);
      }
      return json(buildResponse(player, player?.discord_member === true));
    }

    const requestedPassportUrl = typeof body.stellar_passport_url === "string" && body.stellar_passport_url.trim()
      ? body.stellar_passport_url.trim()
      : null;
    // Auto-heal legacy links stored before bio/social columns existed: re-fetch
    // once so stellar_passport_bio isn't stuck null forever without a manual unlink+relink.
    const staleLinkedUrl = !requestedPassportUrl && existingPlayer?.stellar_passport_url && !existingPlayer?.stellar_passport_bio
      ? existingPlayer.stellar_passport_url
      : null;

    let stellarPassportUrl: string | undefined;
    let passportProfile: Record<string, any> | null = null;
    if (requestedPassportUrl || staleLinkedUrl) {
      const candidate = requestedPassportUrl || staleLinkedUrl!;
      let linkedUsername: string | undefined;
      try {
        const parsed = new URL(candidate);
        if (parsed.protocol === "https:") {
          const segments = parsed.pathname.split("/").filter(Boolean);
          linkedUsername = segments[segments.length - 1];
        }
      } catch {
        // Not a valid URL — falls through to the 400 below.
      }
      if (!linkedUsername) return json({ error: "URL de Stellar Passport inválida" }, 400);

      const passportApiKey = Deno.env.get("STELLAR_PASSPORT_API_KEY");
      const builderResponse = passportApiKey
        ? await fetch(`${PASSPORT_API_BASE}/builders/${encodeURIComponent(linkedUsername)}`, {
            headers: { Authorization: `Bearer ${passportApiKey}` },
          })
        : null;

      if (builderResponse?.status === 429) {
        return json({ error: "Límite de la API de Passport alcanzado, probá de nuevo en un rato" }, 429);
      }
      if (builderResponse && !builderResponse.ok && builderResponse.status !== 404) {
        return json({ error: "No se pudo validar el perfil de Stellar Passport" }, 502);
      }

      let builderData: Record<string, any>;
      if (builderResponse?.ok) {
        builderData = await builderResponse.json();
      } else {
        const publicBuilderResponse = await fetch(
          `https://demo.stellarpassport.xyz/api/builder/public/${encodeURIComponent(linkedUsername)}`,
        );
        if (publicBuilderResponse.status === 429) {
          return json({ error: "Límite de la API de Passport alcanzado, probá de nuevo en un rato" }, 429);
        }
        if (publicBuilderResponse.status === 404) {
          return json({ error: "No encontramos ese perfil en Stellar Passport" }, 404);
        }
        if (!publicBuilderResponse.ok) {
          return json({ error: "No se pudo validar el perfil de Stellar Passport" }, 502);
        }
        builderData = await publicBuilderResponse.json();
      }

      passportProfile = normalizePassportProfile(builderData, linkedUsername);
      stellarPassportUrl = candidate;
    }

    const { data: player, error: upsertError } = await admin
      .from("gaming_players")
      .upsert(
        {
          discord_id: discordId,
          display_name: cleanText(passportProfile?.display_name ?? displayName, 120),
          username,
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
          ...(passportProfile?.stellar_passport_avatar_url ? { avatar_url: passportProfile.stellar_passport_avatar_url } : {}),
          ...(passportProfile ? passportProfile : {}),
          ...(stellarPassportUrl
            ? {
                stellar_passport_url: stellarPassportUrl,
                stellar_passport_name: passportProfile?.stellar_passport_name ?? existingPlayer?.stellar_passport_name ?? null,
              }
            : {}),
        },
        { onConflict: "discord_id" },
      )
      .select(PLAYER_SELECT)
      .single();
    if (upsertError) {
      console.error("gaming_players upsert failed", upsertError);
      return json({ error: "No se pudo guardar la verificación" }, 500);
    }

    // Primera vez que esta persona usa Tierly (sin importar si ya estaba en el
    // server de Discord desde antes, así que guildMemberAdd no la cubre).
    if (!existingPlayer) {
      const welcomeBotToken = Deno.env.get("DISCORD_BOT_TOKEN");
      const welcomeGuildId = Deno.env.get("DISCORD_GUILD_ID");
      if (welcomeBotToken && welcomeGuildId) {
        try {
          let welcomeChannelId = Deno.env.get("WELCOME_CHANNEL_ID");
          if (!welcomeChannelId) {
            const channelsResponse = await fetch(
              `https://discord.com/api/v10/guilds/${welcomeGuildId}/channels`,
              { headers: { Authorization: `Bot ${welcomeBotToken}` } },
            );
            if (channelsResponse.ok) {
              const channels = await channelsResponse.json();
              welcomeChannelId = channels.find(
                (c: { name: string; type: number }) => c.name === "bienvenida-tierly" && c.type === 0,
              )?.id;
            }
          }
          if (welcomeChannelId) {
            await fetch(`https://discord.com/api/v10/channels/${welcomeChannelId}/messages`, {
              method: "POST",
              headers: { Authorization: `Bot ${welcomeBotToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                content: `🐈‍⬛ ¡Bienvenido/a a Tierly, <@${discordId}>! Ya sos parte del leaderboard gaming de Tellus → https://telluscoop.org/tierly`,
              }),
            });
          }
        } catch (welcomeError) {
          console.error("No se pudo enviar el saludo de bienvenida a Discord", welcomeError);
        }
      }
    }

    const isFresh = player?.discord_verified_at &&
      Date.now() - new Date(player.discord_verified_at).getTime() < VERIFY_TTL_MS;
    if (isFresh) {
      return json(buildResponse(player, player.discord_member === true));
    }

    const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
    const guildId = Deno.env.get("DISCORD_GUILD_ID");
    if (!botToken || !guildId) return json({ error: "Discord todavía no está configurado" }, 503);

    const memberResponse = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
      { headers: { Authorization: `Bot ${botToken}` } },
    );
    if (!memberResponse.ok && memberResponse.status !== 404) {
      return json({ error: "No se pudo verificar la membresía" }, 502);
    }

    const isMember = memberResponse.status === 200;
    const { error: updateError } = await admin
      .from("gaming_players")
      .update({ discord_member: isMember, discord_verified_at: new Date().toISOString() })
      .eq("discord_id", discordId);
    if (updateError) {
      console.error("gaming_players update failed", updateError);
      return json({ error: "No se pudo guardar la verificación" }, 500);
    }

    const { data: refreshedPlayer, error: refreshedPlayerError } = await admin
      .from("gaming_players")
      .select(PLAYER_SELECT)
      .eq("discord_id", discordId)
      .maybeSingle();
    if (refreshedPlayerError) {
      console.error("gaming_players select failed", refreshedPlayerError);
      return json({ error: "No se pudo guardar la verificación" }, 500);
    }

    return json(buildResponse(refreshedPlayer ?? player, isMember));
      } catch (error) {
        console.error(error);
        return json({ error: "Error de verificación" }, 500);
      }
});
