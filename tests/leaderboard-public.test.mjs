// tests/leaderboard-public.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../tierly/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../tierly/app.js", import.meta.url), "utf8");
const vercelConfig = await readFile(new URL("../vercel.json", import.meta.url), "utf8");

test("vercel.json rewrites /tierly to tierly/index.html", () => {
  const rules = JSON.parse(vercelConfig).rewrites;
  assert.ok(rules.some((r) => r.source === "/tierly" && r.destination === "/tierly/index.html"));
});

test("public page renders the ranking, bracket, rewards, and auth sections", () => {
  assert.match(page, /id="lb-ranking"/);
  assert.match(page, /id="lb-bracket"/);
  assert.match(page, /id="lb-rewards"/);
  // Auth mounts inside the Discord card, rendered by app.js rather than static markup.
  assert.match(page + app, /id="lb-auth"/);
});

test("public page loads the ranking unconditionally, not behind a login gate", () => {
  const initOrder = app.slice(app.indexOf("loadRanking();"), app.indexOf("loadRanking();") + 40);
  assert.match(initOrder, /loadRanking\(\);/);
  assert.doesNotMatch(app, /if\s*\(!session\)[\s\S]{0,120}loadRanking\(\)/);
});

test("public page reads only the public views, never the base gaming tables", () => {
  assert.match(app, /leaderboard_public_view/);
  assert.match(app, /event_bracket_public_view/);
  assert.match(app, /gaming_rewards_public_view/);
  assert.doesNotMatch(app, /from\("gaming_players"\)/);
  assert.doesNotMatch(app, /from\("gaming_scores"\)/);
  assert.doesNotMatch(app, /from\("gaming_rewards"\)/);
});

test("public page is bilingual (en/es)", () => {
  assert.match(app, /en:\s*{/);
  assert.match(app, /es:\s*{/);
});

test("public page never embeds secrets", () => {
  assert.doesNotMatch(app, /service[_-]?role/i);
  assert.doesNotMatch(app, /DISCORD_BOT_TOKEN/);
  assert.doesNotMatch(app, /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\./);
});

test("Tierly resolves Discord avatars from metadata and renders an initials fallback", () => {
  assert.match(app, /function resolveAvatarUrl\(/);
  assert.match(app, /user_metadata\?\.avatar_url/);
  assert.match(app, /user_metadata\?\.picture/);
  assert.match(app, /identity_data\?\.avatar_url/);
  assert.match(app, /lb-session-avatar-fallback/);
  assert.match(app, /onerror/);
  assert.match(page, /\.lb-session-avatar-fallback\s*\{[^}]*display:\s*inline-flex/);
  assert.match(page, /\.lb-session-avatar-fallback\s*\{[^}]*width:\s*22px/);
  assert.match(page, /\.lb-session-avatar-fallback\s*\{[^}]*justify-content:\s*center/);
  assert.match(app, /function formatDiscordVerifyError\(/);
  assert.match(app, /context\?\.status/);
});

test("Passport linking reports safe actionable errors and every external profile image has a fallback", () => {
  assert.match(app, /function formatPassportLinkError\(/);
  assert.match(app, /data\?\.error/);
  assert.match(app, /lb-passport-link-error/);
  assert.match(app, /lb-rank-avatar-fallback/);
  assert.match(app, /onerror=/);
  assert.match(app, /renderImageWithFallback|onerror=.*nextElementSibling/);
  assert.match(page, /\.lb-passport-link-error/);
});
