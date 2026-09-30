import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

// El bot es el único consumidor de algunas tablas y RPCs. Cuando una migración
// las dropea, el bot no falla: hace return temprano y la funcionalidad desaparece
// en silencio. Estos tests atajan ese contrato contra el SQL del repo.

const botDir = new URL("../discord-bot/", import.meta.url);
const migrationsDir = new URL("../supabase/migrations/", import.meta.url);

const botFiles = await readdir(botDir);
const botSource = (
  await Promise.all(
    botFiles
      .filter((f) => f.endsWith(".js") || f.endsWith(".mjs"))
      .map((f) => readFile(new URL(f, botDir), "utf8")),
  )
).join("\n");

const migrationFiles = await readdir(migrationsDir);
const migrationSource = (
  await Promise.all(
    migrationFiles
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFile(new URL(f, migrationsDir), "utf8")),
  )
).join("\n");

const tables = [...new Set([...botSource.matchAll(/\.from\(\s*"([a-z0-9_]+)"\s*\)/g)].map((m) => m[1]))].sort();
const rpcs = [...new Set([...botSource.matchAll(/\.rpc\(\s*"([a-z0-9_]+)"/g)].map((m) => m[1]))].sort();

test("el bot usa al menos una tabla y una RPC (evita un test vacío)", () => {
  assert.ok(tables.length > 0, "no se detectaron tablas en discord-bot");
  assert.ok(rpcs.length > 0, "no se detectaron RPCs en discord-bot");
});

test("toda tabla o vista que consulta el bot existe en las migraciones del repo", () => {
  const missing = tables.filter((t) => {
    const created = new RegExp(
      `create (table( if not exists)?|or replace view|view) public\\.${t}\\b`,
      "i",
    );
    return !created.test(migrationSource);
  });
  assert.deepEqual(missing, [], `objetos usados por el bot sin migración: ${missing.join(", ")}`);
});

test("toda RPC que llama el bot existe en las migraciones del repo", () => {
  const missing = rpcs.filter(
    (r) => !new RegExp(`create or replace function public\\.${r}\\s*\\(`, "i").test(migrationSource),
  );
  assert.deepEqual(missing, [], `RPCs usadas por el bot sin migración: ${missing.join(", ")}`);
});

test("el seguimiento de anuncios del bot tiene su propia tabla, no la de recordatorios", () => {
  // tierly_event_notifications es una cola de entrega con status pending/sent y
  // kind restringido a 'event_reminder'; no puede llevar el registro de "ya
  // anunciado" de gaming_bot_notifications.
  assert.match(migrationSource, /create table( if not exists)? public\.gaming_bot_notifications\b/i);
  const notifications = migrationSource.match(
    /create table( if not exists)? public\.tierly_event_notifications\s*\(([\s\S]*?)\n\);/i,
  );
  assert.ok(notifications, "no se encontró la definición de tierly_event_notifications");
  assert.match(notifications[2], /kind text not null check \(kind in \('event_reminder'\)\)/i);
  assert.doesNotMatch(notifications[2], /ref_id/i);
});

test("la tabla de seguimiento del bot queda cerrada a anon y authenticated", () => {
  const table = migrationSource.match(
    /create table( if not exists)? public\.gaming_bot_notifications[\s\S]*?unique \(kind, ref_id\)\s*\);/i,
  );
  assert.ok(table, "no se encontró la definición de gaming_bot_notifications");
  assert.match(migrationSource, /enable row level security/i);
  assert.match(
    migrationSource,
    /revoke all on table public\.gaming_bot_notifications from anon, authenticated/i,
  );
  assert.match(migrationSource, /grant select, insert on (table )?public\.gaming_bot_notifications to service_role/i);
  assert.doesNotMatch(table[0], /discord_user_id|display_name|message|token/i);
});
