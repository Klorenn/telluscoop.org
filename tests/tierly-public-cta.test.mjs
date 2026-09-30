import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../tierly/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../tierly/app.js", import.meta.url), "utf8");

test("el ranking público incluye CTA de Discord, sesión y fallback accesible", () => {
  assert.match(page, /id="lb-side"/);
  assert.match(page, /\.lb-discord-cta-action/);
  assert.match(app, /loginPrompt: "Sync your profile, check your history, and join events\."/);
  assert.match(app, /loginPrompt: "Sincroniza tu perfil, revisa tu historial y participa en eventos\."/);
  assert.match(app, /currentSession \? renderSessionAvatar\(currentSession\.user\)/);
  assert.match(app, /viewYourProfile/);
  assert.match(app, /switchView\("profile"\)/);
});

test("la franja de administrador depende de community_admins y no aparece para no-admin", () => {
  assert.match(page, /id="lb-admin-banner"[^>]*hidden/);
  assert.match(app, /from\("community_admins"\)\.select\("guild_id, role"\)/);
  assert.match(app, /banner\.hidden = !isAdmin/);
  assert.match(app, /href="\/tierly\/admin"/);
  assert.match(app, /adminPanel: "Admin panel"/);
  assert.match(app, /adminPanel: "Panel administrador"/);
});

test("chess y racer conservan scripts con la misma versión de caché", () => {
  const versions = [...page.matchAll(/src="\/tierly\/(?:app|chess|admin)\.js\?v=([^"']+)/g)].map((match) => match[1]);
  assert.equal(new Set(versions).size, 1);
});
