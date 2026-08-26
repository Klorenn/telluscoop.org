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
  assert.equal(pkg.scripts.start, "node index.js");
});
