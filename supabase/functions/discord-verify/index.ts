import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://telluscoop.org",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VERIFY_TTL_MS = 10 * 60 * 1000;

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

    const discordIdentity = user.identities?.find((i: { provider: string }) => i.provider === "discord");
    const discordId = discordIdentity?.identity_data?.provider_id ?? discordIdentity?.identity_data?.sub;
    if (!discordId) return json({ error: "Sesión sin identidad de Discord" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: player } = await admin
      .from("gaming_players")
      .upsert(
        {
          discord_id: discordId,
          display_name: discordIdentity?.identity_data?.full_name ?? discordIdentity?.identity_data?.name ?? null,
          avatar_url: discordIdentity?.identity_data?.avatar_url ?? null,
        },
        { onConflict: "discord_id" },
      )
      .select("discord_member, discord_verified_at")
      .single();

    const isFresh = player?.discord_verified_at &&
      Date.now() - new Date(player.discord_verified_at).getTime() < VERIFY_TTL_MS;
    if (isFresh) return json({ verified: player.discord_member === true });

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

    return json({ verified: isMember });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Error de verificación" }, 500);
  }
});
