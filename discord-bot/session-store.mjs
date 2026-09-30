import { normalizeGameName, displayNameFor } from "./game-normalize.mjs";

const TABLE = "play_sessions";

function throwIfError(result) {
  if (result?.error) throw result.error;
  return result?.data;
}

export class SessionStore {
  constructor(supabase) {
    if (!supabase || typeof supabase.from !== "function") {
      throw new TypeError("Se requiere una dependencia Supabase válida");
    }
    this.supabase = supabase;
  }

  async resolveGame(rawActivityName) {
    const alias = await this.supabase
      .from("game_aliases")
      .select("game_id")
      .eq("raw_activity_name", rawActivityName)
      .maybeSingle();
    if (alias?.error) throw alias.error;
    if (alias?.data?.game_id) return alias.data.game_id;

    const canonicalName = normalizeGameName(rawActivityName);
    const game = await this.supabase
      .from("games")
      .upsert({ canonical_name: canonicalName, display_name: displayNameFor(rawActivityName) }, { onConflict: "canonical_name" })
      .select("id")
      .single();
    if (game?.error) throw game.error;

    const createdAlias = await this.supabase
      .from("game_aliases")
      .upsert({ raw_activity_name: rawActivityName, game_id: game.data.id }, { onConflict: "raw_activity_name" })
      .select("game_id")
      .single();
    if (createdAlias?.error) throw createdAlias.error;
    return createdAlias.data.game_id;
  }

  async openSession({ guildId, discordUserId, gameId, startedAt } = {}) {
    const values = {
      guild_id: guildId,
      discord_user_id: discordUserId,
      game_id: gameId,
    };
    if (startedAt !== undefined) {
      values.started_at = startedAt;
      values.last_heartbeat_at = startedAt;
    }

    try {
      const result = await this.supabase
        .from(TABLE)
        .insert(values)
        .select()
        .single();
      return throwIfError(result);
    } catch (error) {
      if (error?.code !== "23505") throw error;
      const existing = await this.supabase
        .from(TABLE)
        .select()
        .eq("guild_id", guildId)
        .eq("discord_user_id", discordUserId)
        .eq("game_id", gameId)
        .is("ended_at", null)
        .single();
      return throwIfError(existing);
    }
  }

  async heartbeatSession(sessionId, heartbeatAt = new Date().toISOString()) {
    const result = await this.supabase
      .from(TABLE)
      .update({ last_heartbeat_at: heartbeatAt })
      .eq("id", sessionId)
      .is("ended_at", null)
      .select()
      .single();
    return throwIfError(result);
  }

  async closeSession(sessionId, endedAt = new Date().toISOString(), reason = "normal") {
    const result = await this.supabase
      .from(TABLE)
      .update({ ended_at: endedAt, closed_reason: reason })
      .eq("id", sessionId)
      .is("ended_at", null)
      .select()
      .single();
    return throwIfError(result);
  }

  async closeStaleSessions({ guildId, before, endedAt = new Date().toISOString() } = {}) {
    let query = this.supabase
      .from(TABLE)
      .update({ ended_at: endedAt, closed_reason: "heartbeat" })
      .is("ended_at", null)
      .lt("last_heartbeat_at", before);
    if (guildId !== undefined) query = query.eq("guild_id", guildId);
    return throwIfError(await query.select());
  }

  async reconcileOpenSessions({ guildId, endedAt = new Date().toISOString(), reason = "crash" } = {}) {
    let query = this.supabase
      .from(TABLE)
      .update({ ended_at: endedAt, closed_reason: reason })
      .is("ended_at", null);
    if (guildId !== undefined) query = query.eq("guild_id", guildId);
    return throwIfError(await query.select());
  }
}

export function createSessionStore(supabase) {
  return new SessionStore(supabase);
}
