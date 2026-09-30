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

test("el panel solo consulta fuentes agregadas y catálogos autorizados", () => {
  for (const table of ["community_admins", "daily_game_rollups", "suggested_events", "games", "communities"]) {
    assert.match(admin, new RegExp(`from\\(["']${table}["']\\)`));
  }
  assert.doesNotMatch(admin, /from\(["']play_sessions["']\)/);
  assert.doesNotMatch(admin, /discord_user_id/);
  assert.match(admin, /cobertura parcial|partial coverage/i);
});

test("la única escritura posible es la RPC segura de estado de sugerencia", () => {
  assert.match(admin, /rpc\(["']tierly_update_suggestion_status["']/);
  assert.doesNotMatch(admin, /\.insert\(|\.upsert\(|\.delete\(|\.update\(/);
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
