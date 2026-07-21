import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../ops/social/app.js", import.meta.url), "utf8");
const page = await readFile(new URL("../ops/social/index.html", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260717120000_create_social_analyzer.sql", import.meta.url), "utf8");
const topicsMigration = await readFile(new URL("../supabase/migrations/20260717150000_create_social_topics.sql", import.meta.url), "utf8");
const articlesMigration = await readFile(new URL("../supabase/migrations/20260717140000_create_articles.sql", import.meta.url), "utf8");
const edge = await readFile(new URL("../supabase/functions/generate-article/index.ts", import.meta.url), "utf8");
const redditEdge = await readFile(new URL("../supabase/functions/reddit-search/index.ts", import.meta.url), "utf8");

test("production cache versions match", () => {
  const cssVersion = page.match(/styles\.css\?v=([^"']+)/)?.[1];
  const jsVersion = page.match(/app\.js\?v=([^"']+)/)?.[1];
  assert.ok(cssVersion);
  assert.equal(jsVersion, cssVersion);
});

test("page is private and not indexable", () => {
  assert.match(page, /noindex,nofollow/);
});

test("seed accounts cover every curated handle", () => {
  for (const handle of [
    "telluscoop", "midudev", "DotCSV", "0xJokker", "dev_gen88926", "precisox", "SantiTorAI",
    "marclou", "jackfriks", "athcanft", "wickedguro", "levelsio",
    "vitaliidodonov", "robj3d3", "illyism", "kalashvasaniya",
    "gregisenberg", "tibo_maker", "sushilwtf", "robiartec",
  ]) assert.match(migration, new RegExp(`'${handle}'`), `missing seed account ${handle}`);
});

test("every social table enables RLS", () => {
  const all = migration + topicsMigration;
  for (const table of ["social_accounts", "social_posts", "repo_picks", "social_topics"]) {
    assert.match(all, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(all, new RegExp(`${table}_member_select`));
    assert.match(all, new RegExp(`${table}_member_all`));
  }
});

test("writes are blocked for viewer role", () => {
  const writePolicies = (migration + topicsMigration).match(/_member_all[\s\S]*?with check[\s\S]*?;/g) || [];
  assert.equal(writePolicies.length, 4);
  for (const policy of writePolicies) assert.match(policy, /m\.role <> 'viewer'/);
});

test("app never embeds AI or scraper secrets", () => {
  assert.doesNotMatch(app, /AIza[0-9A-Za-z_-]{20,}/, "Google API key leaked");
  assert.doesNotMatch(app, /GEMINI_API_KEY/, "Gemini key env leaked to frontend");
  assert.doesNotMatch(app, /service[_-]?role/i, "service-role reference in frontend");
  assert.doesNotMatch(app, /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\./, "a JWT is hardcoded in the frontend");
});

test("manual capture marks source and scraper source is reserved", () => {
  assert.match(app, /source: "manual"/);
  assert.match(migration, /check \(source in \('manual', 'scraper'\)\)/);
});

test("github search uses the public API with no token in the frontend", () => {
  const fetchCall = app.match(/fetch\(`https:\/\/api\.github\.com\/search\/repositories[\s\S]*?\}\);/)?.[0];
  assert.ok(fetchCall, "github fetch call not found");
  assert.doesNotMatch(fetchCall, /Authorization/);
  assert.match(fetchCall, /Accept: "application\/vnd\.github\+json"/);
});

test("preview mode is read-only", () => {
  assert.match(app, /preview.*solo lectura|solo lectura/i);
});

test("articles tables enable RLS and block viewers from writing", () => {
  for (const table of ["article_prompts", "articles"]) {
    assert.match(articlesMigration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(articlesMigration, new RegExp(`${table}_member_all[\\s\\S]*?m\\.role <> 'viewer'`));
  }
});

test("both editorial prompt templates are seeded", () => {
  assert.match(articlesMigration, /'crypto', 'Cripto diario/);
  assert.match(articlesMigration, /'ai', 'IA diario/);
});

test("edge function keeps the Gemini key server-side and requires a session", () => {
  assert.match(edge, /Deno\.env\.get\("GEMINI_API_KEY"\)/);
  assert.doesNotMatch(app, /GEMINI_API_KEY/);
  assert.match(edge, /Sesión requerida/);
  assert.match(edge, /\.neq\("role", "viewer"\)/);
});

test("edge function grounds articles with google search for real sources", () => {
  assert.match(edge, /google_search/);
  assert.match(edge, /url_citation/);
});

test("article generation lets the user pick how many (1-5)", () => {
  assert.match(app, /articleForm\.count/);
  assert.match(edge, /Math\.min\(5, Number\(body\.count\)/);
});

test("repo finder can generate an X post about a repo", () => {
  assert.match(app, /data-post-repo-result|data-post-repo-saved/);
  assert.match(app, /format: "x_post", repo/);
  assert.match(edge, /body\.format === "x_post"/);
  assert.match(edge, /function generatePost/);
});

test("generated X posts still ground their sources", () => {
  const postFn = edge.match(/async function generatePost[\s\S]*?\n\}/)?.[0];
  assert.ok(postFn, "generatePost not found");
  assert.match(postFn, /callGemini\(/);
  assert.match(postFn, /collectSources/);
  const geminiFn = edge.match(/async function callGemini[\s\S]*?\n\}/)?.[0];
  assert.ok(geminiFn, "callGemini not found");
  assert.match(geminiFn, /google_search/);
});

test("gemini calls fall back across models when one is overloaded", () => {
  const models = edge.match(/const MODELS = \[[\s\S]*?\]/)?.[0];
  assert.ok(models, "MODELS list not found");
  assert.match(models, /gemini-3\.5-flash/);
  assert.match(models, /gemini-2\.5-flash/);
  assert.match(edge, /for \(const model of MODELS\)/);
});

test("social posts mode accepts an optional Beehiiv link and covers every channel", () => {
  assert.match(edge, /body\.format === "social_posts"/);
  assert.match(edge, /link is optional/i);
  assert.match(edge, /sin inventar links/);
  assert.match(app, /format: "social_posts"/);
  for (const channel of ["whatsapp", "linkedin"]) assert.match(edge, new RegExp(channel));
  assert.match(app, /data-social-posts/);
  assert.match(app, /data-copy-social/);
});

test("articles keep the user's full markdown format and open in a large view", () => {
  assert.match(edge, /el artículo completo en Markdown/);
  assert.doesNotMatch(edge, /ARTICLE_JSON_CONTRACT/);
  assert.match(app, /data-open-article/);
  assert.match(app, /article-full/);
});

test("style rules enforce Stellar spelling and ban dash punctuation, threaded with a language switch", () => {
  for (const source of [edge, redditEdge]) {
    assert.match(source, /function styleRules/);
    assert.match(source, /NUNCA.*estelar|never.*estelar/i);
    assert.match(source, /No uses guiones/);
    assert.match(source, /readLang/);
  }
  assert.match(app, /state\.lang/);
  assert.match(app, /data-lang="es"/);
  assert.match(app, /data-lang="en"/);
  assert.match(app, /localStorage\.setItem\("gen_lang"/);
});

test("daily reply batch comments on the strongest scraped posts in one gemini call", () => {
  assert.match(edge, /body\.format === "tweet_reply_batch"/);
  assert.match(edge, /"replies":\s*\[/);
  assert.match(app, /format: "tweet_reply_batch"/);
  assert.match(app, /gen-daily-replies/);
  assert.match(app, /sort\(\(a, b\) => \(b\.views \|\| 0\) - \(a\.views \|\| 0\)\)/);
});

test("tweet reply generator produces a comment and a quote from pasted tweet data", () => {
  assert.match(edge, /body\.format === "tweet_reply"/);
  assert.match(edge, /"comment".*"quote"/);
  assert.match(app, /format: "tweet_reply"/);
  assert.match(app, /tweet-reply-form/);
});

test("rewrite_article mode reuses the user's template on pasted source text, any language, no fresh search", () => {
  assert.match(edge, /body\.format === "rewrite_article"/);
  assert.match(edge, /async function rewriteArticle/);
  assert.match(edge, /No hagas una búsqueda nueva/);
  assert.match(app, /format: "rewrite_article"/);
  assert.match(app, /rewrite-form/);
});
