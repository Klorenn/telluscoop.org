import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://telluscoop.org",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VERIFY_TTL_MS = 10 * 60 * 1000;
const PASSPORT_API_BASE = "https://demo.stellarpassport.xyz/api/v1";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
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

    let stellarPassportUrl: string | undefined;
    let stellarPassportName: string | null | undefined;
    if (typeof body.stellar_passport_url === "string" && body.stellar_passport_url.trim()) {
      const candidate = body.stellar_passport_url.trim();
      let username: string | undefined;
      try {
        const parsed = new URL(candidate);
        if (parsed.protocol === "https:") {
          const segments = parsed.pathname.split("/").filter(Boolean);
          username = segments[segments.length - 1];
        }
      } catch {
        // Not a valid URL — falls through to the 400 below.
      }
      if (!username) return json({ error: "URL de Stellar Passport inválida" }, 400);

      const passportApiKey = Deno.env.get("STELLAR_PASSPORT_API_KEY");
      if (!passportApiKey) return json({ error: "Stellar Passport todavía no está configurado" }, 503);

      // Real read-only check against Passport's own API — a self-reported URL
      // is never trusted or saved on its own.
      const builderResponse = await fetch(`${PASSPORT_API_BASE}/builders/${encodeURIComponent(username)}`, {
        headers: { Authorization: `Bearer ${passportApiKey}` },
      });
      if (builderResponse.status === 429) return json({ error: "Límite de la API de Passport alcanzado, probá de nuevo en un rato" }, 429);
      if (!builderResponse.ok) return json({ error: "No encontramos ese perfil en Stellar Passport" }, 404);

      const builder = await builderResponse.json();
      stellarPassportUrl = candidate;
      stellarPassportName = builder.data?.name ?? null;
    }

    const { data: player } = await admin
      .from("gaming_players")
      .upsert(
        {
          discord_id: discordId,
          display_name: discordIdentity?.identity_data?.full_name ?? discordIdentity?.identity_data?.name ?? null,
          avatar_url: discordIdentity?.identity_data?.avatar_url ?? null,
          ...(stellarPassportUrl ? { stellar_passport_url: stellarPassportUrl, stellar_passport_name: stellarPassportName } : {}),
        },
        { onConflict: "discord_id" },
      )
      .select("discord_member, discord_verified_at, stellar_passport_url, stellar_passport_name")
      .single();

    const isFresh = player?.discord_verified_at &&
      Date.now() - new Date(player.discord_verified_at).getTime() < VERIFY_TTL_MS;
    if (isFresh) {
      return json({
        verified: player.discord_member === true,
        stellar_passport_url: player.stellar_passport_url ?? null,
        stellar_passport_name: player.stellar_passport_name ?? null,
      });
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
    await admin
      .from("gaming_players")
      .update({ discord_member: isMember, discord_verified_at: new Date().toISOString() })
      .eq("discord_id", discordId);

    return json({
      verified: isMember,
      stellar_passport_url: stellarPassportUrl ?? player?.stellar_passport_url ?? null,
      stellar_passport_name: stellarPassportName ?? player?.stellar_passport_name ?? null,
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Error de verificación" }, 500);
  }
});
