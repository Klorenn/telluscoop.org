import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const admin = readFileSync(new URL("../tierly/admin.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../tierly/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../tierly/index.html", import.meta.url), "utf8");

test("el panel admin se carga como módulo separado y comparte TierlyBridge", () => {
  assert.match(html, /\/tierly\/admin\.js\?v=\d{8}-\d+/);
  assert.match(admin, /window\.TierlyBridge/);
  assert.match(app, /window\.TierlyBridge/);
});

test("el panel admin reconoce la ruta y ofrece las cuatro vistas", () => {
  assert.match(admin, /\/tierly\/admin/);
  assert.match(admin, /\/tierly\?admin=1/);
  assert.match(html, /data-view="admin"[^>]*data-admin-route/);
  for (const view of ["games", "players", "trends", "suggestions"]) {
    assert.match(admin, new RegExp(`\"${view}\"`));
  }
});

test("el panel resuelve al jugador por la sesión y conserva discord_user_id fuera del HTML", () => {
  for (const table of ["community_admins", "daily_game_rollups", "suggested_events", "games", "communities", "tierly_admin_game_players"]) {
    assert.match(admin, new RegExp(`from\\(["']${table}["']\\)`));
  }
  assert.match(admin, /from\(["']gaming_players["']\)/);
  assert.match(admin, /eq\(["']auth_user_id["'], state\.session\.user\.id\)/);
  assert.doesNotMatch(admin, /from\(["']play_sessions["']\)/);
  assert.doesNotMatch(admin, /discord_user_id/);
  assert.match(admin, /display_name/);
  assert.match(admin, /avatar_url/);
});

test("la migración mantiene RLS y evita filtrar identidades hacia la página pública", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260930120000_tierly_observed_member_identity.sql", import.meta.url), "utf8");
  assert.match(migration, /security_invoker\s*=\s*true/);
  assert.match(migration, /grant select on public\.tierly_admin_game_players to authenticated/i);
  assert.doesNotMatch(html, /tierly_admin_game_players|observed_members/);
  assert.doesNotMatch(admin, /discord_user_id/);
});

test("cada juego del panel usa un icono Lucide determinista y controlado", () => {
  assert.match(admin, /function gameIcon\(game\)/);
  assert.match(admin, /canonical_name.*display_name/);
  assert.match(admin, /data-lucide=\"\$\{gameIcon\(game\)\}\"/);
  assert.match(admin, /createIcons\(\)/);
  assert.match(admin, /gameIconNames/);
  assert.match(html, /tierly-admin-game-icon/);
  assert.doesNotMatch(admin, /icon_url|image_url/);
});

test("muestra presencia actual agrupada por juego y conserva histórico", () => {
  assert.match(admin, /Jugando ahora/);
  assert.match(admin, /is_active/);
  assert.match(admin, /started_at/);
  assert.match(admin, /presenceGroups/);
  assert.match(admin, /tierly-admin-history/);
  assert.match(admin, /tierly_admin_game_players.*select\(.*is_active.*started_at/s);
});

test("la migración de presencia conserva el invocador y no expone discord_user_id", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260930220000_tierly_admin_game_presence.sql", import.meta.url), "utf8");
  assert.match(migration, /security_invoker\s*=\s*true/);
  assert.match(migration, /is_active/);
  assert.match(migration, /ended_at\s+is\s+null/);
  assert.match(migration, /started_at/);
  assert.match(migration, /grant select on public\.tierly_admin_game_players to authenticated/i);
  const exposedColumns = migration.split(/\n\s*from public\.play_sessions sessions/i)[0];
  assert.doesNotMatch(exposedColumns, /^\s*sessions\.discord_user_id\s*[,)]/im);
});

test("la única escritura posible es la RPC segura de estado de sugerencia", () => {
  assert.match(admin, /rpc\(["']tierly_update_suggestion_status["']/);
  assert.doesNotMatch(admin, /\.insert\(|\.upsert\(|\.delete\(|\.update\(/);
});

test("las acciones de eventos usan RPC y recargan la UI con errores accesibles", () => {
  for (const rpc of ["tierly_register_event", "tierly_unregister_event", "tierly_check_in_event", "tierly_confirm_event_attendance"]) {
    assert.match(admin, new RegExp(rpc));
  }
  assert.match(admin, /state\.message = result\.error\?\.message/);
  assert.match(admin, /role="alert"/);
  assert.match(admin, /await load\(\)/);
  assert.match(admin, /tierly_xp_ledger/);
  assert.match(admin, /confirmed_at/);
});

test("la navegación pública conserva ranking, chess y racer sin admin antiguo", () => {
  assert.match(html, /data-view="ranking"/);
  assert.match(html, /data-view="chess"/);
  assert.doesNotMatch(app, /tierly_(create_smash_tournament|confirm_match|award_reward)/);
  assert.doesNotMatch(admin, /smash|brackets/i);
});

test("los dos módulos usan versiones de cache busting coherentes", () => {
  const versions = [...html.matchAll(/src="\/tierly\/(?:app|chess|admin)\.js\?v=([^"']+)/g)].map((match) => match[1]);
  assert.ok(versions.length >= 3);
  assert.equal(new Set(versions).size, 1);
});
