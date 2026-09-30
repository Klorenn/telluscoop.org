import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const bot = await readFile(new URL("../discord-bot/index.js", import.meta.url), "utf8");

test("discord-bot never hardcodes a token, guild id, or Supabase key", () => {
  assert.doesNotMatch(bot, /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\./);
  assert.match(bot, /process\.env/);
  assert.doesNotMatch(bot, /["'][MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27,}["']/);
});

test("discord-bot requests the GuildMembers intent so it can see joins", () => {
  assert.match(bot, /GatewayIntentBits\.GuildMembers/);
});

test("discord-bot requests the GuildPresences intent and listens for updates", () => {
  assert.match(bot, /GatewayIntentBits\.GuildPresences/);
  assert.match(bot, /client\.on\("presenceUpdate"/);
});

test("discord-bot greets on ready and welcomes new members", () => {
  assert.match(bot, /client\.once\("ready"/);
  assert.match(bot, /client\.on\("guildMemberAdd"/);
});

test("discord-bot syncs discord_member on join via the service-role client, not client-writable metadata", () => {
  assert.match(bot, /discord_member: true/);
  assert.match(bot, /onConflict: "discord_id"/);
  assert.doesNotMatch(bot, /user_metadata/);
});

const pkg = JSON.parse(await readFile(new URL("../discord-bot/package.json", import.meta.url), "utf8"));

test("discord-bot package declares discord.js and starts via npm start", () => {
  assert.ok(pkg.dependencies["discord.js"]);
  assert.equal(pkg.scripts.start, "node --env-file=.env index.js");
});

test("discord-bot acepta los nombres de variables existentes en el entorno local", () => {
  assert.match(bot, /DISCORD_BOT_TOKEN_ENV \|\| DISCORD_TOKEN/);
  assert.match(bot, /SUPABASE_URL_ENV \|\| NEXT_PUBLIC_SUPABASE_URL/);
});

test("discord-bot mantiene un arranque persistente con systemd documentado", async () => {
  const readme = await readFile(new URL("../discord-bot/README.md", import.meta.url), "utf8");
  assert.match(readme, /EnvironmentFile=.*discord-bot\/\.env/);
  assert.match(readme, /Restart=always/);
  assert.match(readme, /systemctl is-active tierly-bot/);
  assert.match(readme, /node --env-file=\.env/);
});

test("discord-bot documenta la verificación de los tres jobs de cron y rollback", async () => {
  const readme = await readFile(new URL("../discord-bot/README.md", import.meta.url), "utf8");
  for (const job of ["tierly-rollup-diario", "tierly-cerrar-sesiones-viejas", "tierly-sugerencias"]) {
    assert.match(readme, new RegExp(job));
  }
  assert.match(readme, /cron\.job_run_details/);
  assert.match(readme, /rollback/i);
});
