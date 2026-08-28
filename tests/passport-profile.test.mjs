import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const edge = await readFile(new URL("../supabase/functions/passport-profile/index.ts", import.meta.url), "utf8");

test("passport-profile reflects approved production and dynamic local origins", () => {
  assert.match(edge, /https:\/\/telluscoop\.org/);
  assert.match(edge, /https:\/\/www\.telluscoop\.org/);
  assert.match(edge, /LOCAL_ORIGIN/);
  assert.match(edge, /localhost\|127\\.0\\.0\\.1/);
  assert.match(edge, /:\\d\+/);
  assert.match(edge, /Access-Control-Allow-Origin.*origin/);
  assert.match(edge, /Vary: "Origin"/);
});

const helperSource = edge.match(/export async function searchBuilders\([\s\S]*?\n}\n/)?.[0];
assert.ok(helperSource, "passport-profile must expose the pure search helper");
const searchBuilders = new Function(`${helperSource.replace("export ", "")}; return searchBuilders;`)();

const profileHelperSource = edge.match(/export function normalizeBuilderResponse\([\s\S]*?\n}\n/)?.[0];
assert.ok(profileHelperSource, "passport-profile must expose the profile response normalizer");
const normalizeBuilderResponse = new Function(`${profileHelperSource.replace("export ", "")}; return normalizeBuilderResponse;`)();

const page = (names, total) => ({ data: names.map((name) => ({ name, username: name.toLowerCase() })), ...(total === undefined ? {} : { total }) });

test("profile response wraps a direct builder object", () => {
  const builder = { name: "Klorenn", username: "Klorenn" };
  assert.deepEqual({ builder: normalizeBuilderResponse(builder) }, { builder });
});

test("normalizes the public Klorenn envelope", () => {
  const response = {
    builder: { github_username: "Klorenn", display_name: "Klorenn", avatar_url: "avatar" },
    stats: { projects: 3 },
  };
  assert.deepEqual(normalizeBuilderResponse(response), {
    github_username: "Klorenn",
    username: "Klorenn",
    name: "Klorenn",
    display_name: "Klorenn",
    avatar_url: "avatar",
    logo_url: "avatar",
  });
});

test("normalizes the public Passport fields the profile card renders", () => {
  const response = {
    builder: {
      github_username: "Klorenn",
      display_name: "Pau Koh",
      avatar_url: "https://avatars.githubusercontent.com/u/189268805?s=200",
      bio: "builder bio",
      website_url: "https://example.com",
      scf_tier: "navigator",
    },
    stats: { totalCommits30d: 60, activeDays30d: 9, lastActiveDate: "2026-08-26" },
  };
  const normalized = normalizeBuilderResponse(response);
  assert.equal(normalized.username, "Klorenn");
  assert.equal(normalized.name, "Pau Koh");
  assert.equal(normalized.avatar_url, "https://avatars.githubusercontent.com/u/189268805?s=200");
  assert.equal(normalized.logo_url, "https://avatars.githubusercontent.com/u/189268805?s=200");
  assert.equal(normalized.description, "builder bio");
  assert.equal(normalized.website, "https://example.com");
});

test("profile action exposes builder stats and project count from the public envelope", () => {
  assert.match(edge, /response\?\.stats \|\| response\?\.data\?\.stats \|\| builder\?\.stats/);
  assert.match(edge, /Array\.isArray\(response\?\.projects\)/);
  assert.match(edge, /project_count/);
});

test("profile action flattens top 2 repos from projects", () => {
  assert.match(edge, /top_repos/);
  assert.match(edge, /\.slice\(0, 2\)/);
});

test("builder search uses the public fallback without paging", async () => {
  const calls = [];
  const matches = await searchBuilders(async (path) => {
    calls.push(`v1:${path}`);
    throw new Error("passport_404");
  }, "key", "Klorenn", async (path) => {
    calls.push(`public:${path}`);
    return { builder: { github_username: "Klorenn", display_name: "Klorenn" }, stats: { projects: 3 } };
  });

  assert.deepEqual(matches, [{ github_username: "Klorenn", display_name: "Klorenn", username: "Klorenn", name: "Klorenn" }]);
  assert.ok(calls.some((path) => path === "public:/api/builder/public/Klorenn"));
  assert.equal(calls.some((path) => path.includes("?limit=")), false);
});

test("builder search maps the public avatar for suggestion thumbnails", async () => {
  const matches = await searchBuilders(async () => {
    throw new Error("passport_404");
  }, "key", "Klorenn", async () => ({
    builder: { github_username: "Klorenn", display_name: "Pau Koh", avatar_url: "avatar" },
  }));

  assert.equal(matches[0].logo_url, "avatar");
});

test("passport-profile still normalizes public Passport builder data for linking", async () => {
  const app = await readFile(new URL("../tierly/app.js", import.meta.url), "utf8");
  assert.match(app, /renderImageWithFallback\(b\.logo_url, b\.name, "lb-passport-suggest-avatar"\)/);
  assert.match(app, /demo\.stellarpassport\.xyz\/builder\/\$\{encodeURIComponent\(row\.dataset\.username\)\}/);
});

test("Tierly profile uses the synced Tierly fields instead of a separate Passport stats card", async () => {
  const app = await readFile(new URL("../tierly/app.js", import.meta.url), "utf8");
  assert.doesNotMatch(app, /passportCardTitle/);
  assert.doesNotMatch(app, /passportStatsEmpty/);
  assert.doesNotMatch(app, /passportStatsLoading/);
  assert.doesNotMatch(app, /passportStatsError/);
  assert.doesNotMatch(app, /function renderPassportStats/);
  assert.doesNotMatch(app, /currentPlayer\?\.stellar_passport_project_count/);
  assert.doesNotMatch(app, /currentPlayer\?\.stellar_passport_commits_30d/);
  assert.doesNotMatch(app, /currentPlayer\?\.stellar_passport_active_days_30d/);
  assert.doesNotMatch(app, /currentPlayer\?\.stellar_passport_role_title/);
  assert.doesNotMatch(app, /currentPlayer\?\.stellar_passport_tier/);
  assert.match(app, /currentPlayer\?\.bio/);
  assert.match(app, /player\?\.twitter_handle/);
  assert.match(app, /player\?\.instagram_handle/);
  assert.match(app, /player\?\.telegram_handle/);
  assert.match(app, /player\?\.discord_handle/);
  assert.match(app, /action:\s*"update_profile"/);
  assert.match(app, /action:\s*"unlink_passport"/);
});

test("Tierly syncs the persisted player snapshot immediately after verify and link responses", async () => {
  const app = await readFile(new URL("../tierly/app.js", import.meta.url), "utf8");
  assert.match(app, /syncCurrentPlayer\(data\?\.player \|\| currentPlayer,\s*data\?\.stellar_passport_url \|\| currentPassportUrl\)/);
  assert.match(app, /syncCurrentPlayer\(data\?\.player \|\| currentPlayer,\s*effectivePassportUrl\)/);
  assert.match(app, /renderProfileAvatar\(\)/);
  assert.match(app, /renderProfileSummary\(\)/);
});

test("Tierly profile view keeps only the profile card and history blocks", async () => {
  const html = await readFile(new URL("../tierly/index.html", import.meta.url), "utf8");
  assert.match(html, /id="lb-profile-summary"/);
  assert.match(html, /id="lb-profile-history-title"/);
  assert.doesNotMatch(html, /id="lb-profile-account-title"/);
  assert.doesNotMatch(html, /id="lb-passport-card-title"/);
  assert.doesNotMatch(html, /id="lb-passport-stats"/);
});

test("profile normalizes the public Klorenn envelope with stats", () => {
  const response = { builder: { github_username: "Klorenn" }, stats: { projects: 3 } };
  const normalized = normalizeBuilderResponse(response);
  assert.equal(normalized.username, "Klorenn");
  assert.deepEqual(response.stats, { projects: 3 });
});

test("builder search finds a match on page 4+", async () => {
  const calls = [];
  const pages = [page(["one", ...Array(99).fill("other-0")]), page(Array.from({ length: 100 }, (_, i) => `other-1-${i}`)), page(Array.from({ length: 100 }, (_, i) => `other-2-${i}`)), page(["Kl0ren"])];
  const matches = await searchBuilders(async (path) => {
    calls.push(path);
    if (!path.includes("?")) throw new Error("passport_404");
    return pages[calls.length - 3];
  }, "key", "kl0ren");

  assert.equal(matches[0].username, "kl0ren");
  assert.equal(calls.length, 6);
  assert.match(calls[5], /offset=300/);
});

test("builder search prefers a direct username lookup", async () => {
  const calls = [];
  const matches = await searchBuilders(async (path) => {
    calls.push(path);
    if (path.includes("/builders/Klorenn")) return { data: { name: "Klorenn", username: "Klorenn" } };
    throw new Error("listing should not be requested after direct hit");
  }, "key", "Klorenn");

  assert.deepEqual(matches, [{ name: "Klorenn", username: "Klorenn" }]);
  assert.deepEqual(calls, ["/builders/Klorenn"]);
});

test("builder search accepts a direct builder response without a data wrapper", async () => {
  const calls = [];
  const matches = await searchBuilders(async (path) => {
    calls.push(path);
    if (path === "/builders/Klorenn") return { name: "Klorenn", username: "Klorenn" };
    throw new Error("listing should not be requested after direct hit");
  }, "key", "Klorenn");

  assert.deepEqual(matches, [{ name: "Klorenn", username: "Klorenn" }]);
  assert.deepEqual(calls, ["/builders/Klorenn"]);
});

test("builder search retries direct lookup with casing variants", async () => {
  const calls = [];
  const matches = await searchBuilders(async (path) => {
    calls.push(path);
    if (path === "/builders/Klorenn") return { data: { name: "Klorenn", username: "Klorenn" } };
    throw new Error("passport_404");
  }, "key", "klorenn");

  assert.equal(matches[0].username, "Klorenn");
  assert.deepEqual(calls, ["/builders/klorenn", "/builders/Klorenn"]);
});

test("builder search falls back to listing when direct lookup returns 404", async () => {
  const calls = [];
  const matches = await searchBuilders(async (path) => {
    calls.push(path);
    if (path.includes("/builders/missing")) throw new Error("passport_404");
    return page(["missing-builder"]);
  }, "key", "missing");

  assert.equal(matches[0].username, "missing-builder");
  assert.equal(calls[0], "/builders/missing");
  assert.match(calls[2], /\/builders\?limit=100&offset=0/);
});

test("builder search deduplicates repeated paginated matches", async () => {
  const matches = await searchBuilders(async (path) => {
    if (!path.includes("?")) throw new Error("passport_404");
    return page(["Klorenn"]);
  }, "key", "klorenn");

  assert.deepEqual(matches.map((builder) => builder.username), ["klorenn"]);
});

test("Tierly links Passport builders to the builder route", async () => {
  const app = await readFile(new URL("../tierly/app.js", import.meta.url), "utf8");
  assert.match(app, /demo\.stellarpassport\.xyz\/builder\/\$\{encodeURIComponent\(row\.dataset\.username\)\}/);
  assert.match(app, /demo\.stellarpassport\.xyz\/builder\/\$\{encodeURIComponent\(b\.username\)\}/);
});

test("builder search stops at Passport total even when pages are full", async () => {
  let calls = 0;
  const matches = await searchBuilders(async () => {
    calls += 1;
    if (calls <= 2) throw new Error("passport_404");
    return page(Array(100).fill("other"), 200);
  }, "key", "missing");

  assert.deepEqual(matches, []);
  assert.equal(calls, 4);
});

test("builder search stops on a short page without total", async () => {
  let calls = 0;
  const matches = await searchBuilders(async () => {
    calls += 1;
    if (calls <= 2) throw new Error("passport_404");
    return page(["other"]);
  }, "key", "missing");

  assert.deepEqual(matches, []);
  assert.equal(calls, 3);
});

test("builder search stops when a complete page repeats without total", async () => {
  let calls = 0;
  const repeated = page(Array(100).fill("other"));
  const matches = await searchBuilders(async () => {
    calls += 1;
    if (calls <= 2) throw new Error("passport_404");
    return repeated;
  }, "key", "missing");

  assert.deepEqual(matches, []);
  assert.equal(calls, 4);
});
