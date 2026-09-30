import test from "node:test";
import assert from "node:assert/strict";
import { SessionStore } from "../discord-bot/session-store.mjs";

function fakeSupabase({ data = [], error = null, withRpc = false } = {}) {
  const calls = [];
  const api = {
    calls,
    from(table) {
      const query = { table };
      calls.push(query);
      const chain = new Proxy(query, {
        get(target, property) {
          if (property === "then") return target.then;
          if (property === "select" || property === "single") {
            return () => {
              target[property] = true;
              return chain;
            };
          }
          return (...args) => {
            target[property] = args;
            return chain;
          };
        },
      });
      query.then = (resolve, reject) => {
        if (error) return reject(error);
        return resolve({ data, error });
      };
      return chain;
    },
  };
  if (withRpc) {
    api.rpc = (name, args) => {
      calls.push({ rpc: name, args });
      return Promise.resolve({ data, error });
    };
  }
  return api;
}

test("inserta una sesión sin depender de un upsert incompatible con un índice parcial", async () => {
  const supabase = fakeSupabase({ data: { id: 7, presence_enabled: true, consent_status: "accepted" } });
  const store = new SessionStore(supabase);

  await assert.doesNotReject(() => store.openSession({ guildId: "g", discordUserId: "u", gameId: 3 }));
  assert.deepEqual(supabase.calls[2].upsert[0], { guild_id: "g", discord_user_id: "u", last_seen_at: supabase.calls[2].upsert[0].last_seen_at });
  assert.equal(supabase.calls[2].table, "observed_members");
  assert.deepEqual(supabase.calls[3].insert, [{ guild_id: "g", discord_user_id: "u", game_id: 3 }]);
});

test("mantiene el nombre y avatar seguros del miembro observado", async () => {
  const supabase = fakeSupabase({ data: { id: 7, presence_enabled: true, consent_status: "accepted" } });
  const store = new SessionStore(supabase);
  await store.openSession({ guildId: "g", discordUserId: "u", gameId: 3, displayName: "Jugador", avatarUrl: "https://cdn.example/avatar.png" });
  assert.deepEqual(supabase.calls[2].upsert[0], {
    guild_id: "g", discord_user_id: "u", display_name: "Jugador", avatar_url: "https://cdn.example/avatar.png", last_seen_at: supabase.calls[2].upsert[0].last_seen_at,
  });
});

test("actualiza heartbeat y cierra normalmente", async () => {
  const supabase = fakeSupabase({ data: [{ id: 7 }] });
  const store = new SessionStore(supabase);
  await store.heartbeatSession(7, "2026-09-30T10:00:00Z");
  await store.closeSession(7, "2026-09-30T10:05:00Z");
  assert.deepEqual(supabase.calls[0].update, [{ last_heartbeat_at: "2026-09-30T10:00:00Z" }]);
  assert.deepEqual(supabase.calls[1].update, [{ ended_at: "2026-09-30T10:05:00Z", closed_reason: "normal" }]);
});

test("cierra sesiones por heartbeat y reconcilia las abiertas", async () => {
  const supabase = fakeSupabase({ data: [] });
  const store = new SessionStore(supabase);
  await store.closeStaleSessions({ guildId: "g", before: "2026-09-30T09:00:00Z", endedAt: "2026-09-30T10:00:00Z" });
  await store.reconcileOpenSessions({ guildId: "g", endedAt: "2026-09-30T10:01:00Z" });
  assert.equal(supabase.calls[0].update[0].closed_reason, "heartbeat");
  assert.equal(supabase.calls[1].update[0].closed_reason, "crash");
});

test("propaga errores de Supabase", async () => {
  const error = new Error("fallo de base de datos");
  const store = new SessionStore(fakeSupabase({ error }));
  await assert.rejects(() => store.reconcileOpenSessions(), error);
});

test("resuelve una actividad Discord a un game_id persistido", async () => {
  const supabase = fakeSupabase({ data: { game_id: 42 } });
  const store = new SessionStore(supabase);
  await assert.doesNotReject(() => store.resolveGame("Minecraft"));
  assert.equal(supabase.calls[0].table, "game_aliases");
  assert.deepEqual(supabase.calls[0].eq, ["raw_activity_name", "Minecraft"]);
});

test("prepara la comunidad antes de usar tablas con FK", async () => {
  const supabase = fakeSupabase({ data: { guild_id: "g", stale_session_hours: 12 } });
  const store = new SessionStore(supabase);
  await store.ensureCommunity({ guildId: "g", name: "Servidor" });
  assert.equal(supabase.calls[0].table, "communities");
  assert.deepEqual(supabase.calls[0].upsert[0], { guild_id: "g", name: "Servidor" });
});

test("no abre sesiones sin consentimiento aceptado", async () => {
  const supabase = fakeSupabase({ data: { presence_enabled: true, consent_status: "unknown" } });
  const store = new SessionStore(supabase);
  assert.equal(await store.openSession({ guildId: "g", discordUserId: "u", gameId: 3 }), null);
  assert.equal(supabase.calls.some((call) => call.table === "play_sessions"), false);
});

test("gestiona consentimiento y borrado mediante RPCs privados", async () => {
  const supabase = fakeSupabase({ data: true, withRpc: true });
  const store = new SessionStore(supabase);
  await store.acceptMemberConsent("g", "u", "1");
  await store.declineMemberConsent("g", "u");
  await store.requestMemberDeletion("g", "u");
  assert.deepEqual(supabase.calls.map((call) => call.rpc), [
    "tierly_accept_member_consent",
    "tierly_decline_member_consent",
    "tierly_request_member_deletion",
  ]);
});
