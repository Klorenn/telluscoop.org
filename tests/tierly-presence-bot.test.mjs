import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../discord-bot/index.js", import.meta.url), "utf8");

test("solicita presence intent y escucha presenceUpdate", () => {
  assert.match(source, /GatewayIntentBits\.GuildPresences/);
  assert.match(source, /client\.on\("presenceUpdate"/);
  assert.match(source, /presenceDelta/);
});

test("abre y cierra sesiones usando el store existente", () => {
  assert.match(source, /sessions\.openSession\(\{/);
  assert.match(source, /sessions\.closeSession\(/);
  assert.match(source, /playingGames\(/);
});

test("reconcilia al arrancar y ejecuta heartbeat cada cinco minutos", () => {
  assert.match(source, /reconcileOpenSessions/);
  assert.match(source, /reconcilePresence/);
  assert.match(source, /HEARTBEAT_INTERVAL_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/);
  assert.match(source, /setInterval\([\s\S]*HEARTBEAT_INTERVAL_MS/);
  assert.match(source, /heartbeatSession/);
});

test("no registra identificadores ni secretos en logs", () => {
  assert.doesNotMatch(source, /console\.log\([^\n]*(discordUserId|userId|discord_user_id)/i);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][A-Za-z0-9]/);
});

test("aísla errores de presence y heartbeat y usa stale_session_hours", () => {
  assert.match(source, /try \{[\s\S]*sessions\.heartbeatSession/);
  assert.match(source, /getCommunitySettings/);
  assert.match(source, /stale_session_hours/);
  assert.match(source, /sessions\.ensureCommunity/);
});
