import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../ops/social/app.js", import.meta.url), "utf8");
const page = await readFile(new URL("../ops/social/index.html", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260717120000_create_social_analyzer.sql", import.meta.url), "utf8");
const topicsMigration = await readFile(new URL("../supabase/migrations/20260717150000_create_social_topics.sql", import.meta.url), "utf8");
const articlesMigration = await readFile(new URL("../supabase/migrations/20260717140000_create_articles.sql", import.meta.url), "utf8");
const edge = await readFile(new URL("../supabase/functions/generate-article/index.ts", import.meta.url), "utf8");
const xSearchEdge = await readFile(new URL("../supabase/functions/x-search/index.ts", import.meta.url), "utf8");
const redditEdge = await readFile(new URL("../supabase/functions/reddit-search/index.ts", import.meta.url), "utf8");
const guidesMigration = await readFile(new URL("../supabase/migrations/20260721030000_create_guides.sql", import.meta.url), "utf8");
const summaryMigration = await readFile(new URL("../supabase/migrations/20260721040000_create_social_summary.sql", import.meta.url), "utf8");
const xProfileEdge = await readFile(new URL("../supabase/functions/x-profile/index.ts", import.meta.url), "utf8");
const repoSearchEdge = await readFile(new URL("../supabase/functions/repo-search/index.ts", import.meta.url), "utf8");
const growthMigration = await readFile(new URL("../supabase/migrations/20260721050000_monthly_growth_goal_and_cron.sql", import.meta.url), "utf8");
const refreshAllMigration = await readFile(new URL("../supabase/migrations/20260721060000_refresh_all_default_goals_meme_picks.sql", import.meta.url), "utf8");

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

test("repo finder generates one post per channel in a tabbed popup", () => {
  assert.match(app, /data-post-repo-result|data-post-repo-saved/);
  assert.match(app, /format: "repo_social_posts", repo/);
  assert.match(app, /REPO_POST_CHANNELS/);
  for (const channel of ["whatsapp", "discord", "linkedin", "instagram"]) assert.match(app, new RegExp(`"${channel}"`));
  assert.match(app, /function repoPostModal/);
  assert.match(app, /modal-tabs/);
  assert.match(app, /data-repo-tab/);
  assert.match(edge, /body\.format === "repo_social_posts"/);
  assert.match(edge, /function generateRepoSocialPosts/);
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
  assert.match(app, /data-open-social/);
  assert.match(app, /data-copy-social/);
});

test("articles keep the user's full markdown format and open in a popup", () => {
  assert.match(edge, /el artículo completo en Markdown/);
  assert.doesNotMatch(edge, /ARTICLE_JSON_CONTRACT/);
  assert.match(app, /data-open-article/);
  assert.match(app, /modal-overlay/);
  assert.match(app, /function modalShell/);
});

test("markdown renderer supports fenced code blocks with a copy button, and sources render as their own block", () => {
  assert.match(app, /function mdToHtml/);
  assert.match(app, /fence = raw\.trim\(\)\.match/);
  assert.match(app, /data-copy-code/);
  assert.match(app, /function stripSourcesSection/);
  assert.match(app, /function sourcesBlock/);
});

test("articles list has filters, pagination, and a single diffusion action per row", () => {
  assert.match(app, /art-filter-status/);
  assert.match(app, /art-filter-template/);
  assert.match(app, /art-filter-search/);
  assert.match(app, /data-article-page/);
  assert.match(app, /data-open-social/);
  assert.doesNotMatch(app, /data-social-posts=/);
});

test("rewritten and generated drafts are tagged with their real origin, not the currently selected template", () => {
  assert.match(app, /prompt_key: "reescrito"/);
  assert.match(app, /draft\.prompt_key \|\| state\.articleForm\.prompt_key/);
  assert.match(app, /function articleTemplateLabel/);
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

test("guides section generates a docs-grounded guide, posts, and images for every chain", () => {
  assert.match(edge, /body\.format === "guide"/);
  assert.match(edge, /body\.format === "guide_posts"/);
  for (const chain of ["stellar", "avalanche", "circle", "ethereum", "solana", "base", "mantle"]) {
    assert.match(app, new RegExp(`id: "${chain}"`));
  }
  assert.match(app, /developers\.stellar\.org\/docs/);
  assert.match(app, /build\.avax\.network\/docs\/primary-network/);
  assert.match(app, /developers\.circle\.com/);
  assert.match(app, /guidesView/);
  assert.match(app, /guide-form/);
  assert.match(redditEdge, /mode === "images"/);
  assert.match(app, /mode: "images"/);
});

test("guides let the user toggle images/emojis, enforce >=2 sources, add inline hyperlinks, and include SEO/GEO metadata", () => {
  const guideFn = edge.match(/if \(body\.format === "guide"\)[\s\S]*?\n    \}/)?.[0];
  assert.ok(guideFn, "guide format block not found");
  assert.match(guideFn, /AL MENOS 2 fuentes/);
  assert.match(guideFn, /docsUrl.*title.*Documentación oficial/s);
  assert.match(guideFn, /hipervínculo real/);
  assert.match(guideFn, /use_emojis/);
  assert.match(guideFn, /set típico de IA/);
  assert.match(guideFn, /Meta descripción/);
  assert.match(guideFn, /Palabras clave/);
  assert.match(guideFn, /TL;DR/);
  assert.match(guideFn, /imageQuery/);

  assert.match(app, /guide-use-images/);
  assert.match(app, /guide-use-emojis/);
  assert.match(app, /data\.imageQuery/);
  assert.match(app, /sources\.length < 2/);
});

test("guides table is RLS-scoped like articles", () => {
  assert.match(guidesMigration, /alter table public\.guides enable row level security/);
  assert.match(guidesMigration, /guides_member_all[\s\S]*?m\.role <> 'viewer'/);
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

test("reply generators detect the original post's own language and soften tone for repo/project posts", () => {
  const single = edge.match(/if \(body\.format === "tweet_reply"\)[\s\S]*?\n    \}/)?.[0];
  const batch = edge.match(/if \(body\.format === "tweet_reply_batch"\)[\s\S]*?\n    \}/)?.[0];
  assert.ok(single, "tweet_reply block not found");
  assert.ok(batch, "tweet_reply_batch block not found");
  for (const block of [single, batch]) {
    assert.match(block, /responde en ese mismo idioma|responde en (el )?ese mismo idioma/i);
    assert.match(block, /NUNCA negativo/);
    assert.match(block, /lanzamiento de repo/);
  }
  assert.match(edge, /function houseRules/);
});

test("summary tables (metrics, goals) enable RLS and block viewers from writing", () => {
  for (const table of ["social_metrics", "social_goals"]) {
    assert.match(summaryMigration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(summaryMigration, new RegExp(`${table}_member_all[\\s\\S]*?m\\.role <> 'viewer'`));
  }
});

test("own accounts are seeded on LinkedIn and Instagram, tagged tellus-own", () => {
  assert.match(summaryMigration, /'linkedin', 'tellus-cooperative'/);
  assert.match(summaryMigration, /'instagram', 'telluscoop'/);
  assert.match(summaryMigration, /'tellus-own'/);
});

test("Resumen view shows followers, growth, goals and whether today has a post per platform", () => {
  assert.match(app, /function summaryView/);
  assert.match(app, /function summaryPlatform/);
  assert.match(app, /navButton\("summary"/);
  assert.match(app, /Hoy no has posteado/);
  assert.match(app, /data-followers-form/);
  assert.match(app, /data-goals-form/);
  assert.match(app, /data-mark-posted/);
});

test("x-profile edge function requires a session and keeps the scraper server URL out of the frontend", () => {
  assert.match(xProfileEdge, /Sesión requerida/);
  assert.match(xProfileEdge, /\.neq\("role", "viewer"\)/);
  assert.match(xProfileEdge, /Deno\.env\.get\("X_SEARCH_SERVER_URL"\)/);
  assert.doesNotMatch(app, /X_SEARCH_SERVER_URL/);
});

test("x-profile writes follower snapshots and the latest own post as scraper-sourced", () => {
  assert.match(xProfileEdge, /source: "scraper"/);
  assert.match(xProfileEdge, /social_metrics/);
  assert.match(xProfileEdge, /social_posts/);
});

test("repo search widens beyond GitHub's own API with HN (stories+comments) and a Gemini web fallback", () => {
  assert.match(app, /function searchHN/);
  assert.match(app, /hn\.algolia\.com\/api\/v1\/search/);
  assert.match(app, /fetchTag\("story"\), fetchTag\("comment"\)/);
  assert.match(app, /function extractGithubRepos/);
  assert.match(app, /invokeEdge\("repo-search"/);
  assert.match(app, /vía HN|vía web/);
  assert.doesNotMatch(app, /GEMINI_API_KEY/);
});

test("repo-search edge function requires a session, keeps the Gemini key server-side, and validates repos exist on GitHub before returning them", () => {
  assert.match(repoSearchEdge, /Sesión requerida/);
  assert.match(repoSearchEdge, /\.neq\("role", "viewer"\)/);
  assert.match(repoSearchEdge, /Deno\.env\.get\("GEMINI_API_KEY"\)/);
  assert.match(repoSearchEdge, /google_search/);
  assert.match(repoSearchEdge, /async function fetchRepoMeta/);
  assert.match(repoSearchEdge, /api\.github\.com\/repos\//);
});

test("monthly growth goal column and a daily cron for the X profile refresh are set up without hardcoding secrets", () => {
  assert.match(growthMigration, /target_monthly_growth/);
  assert.match(growthMigration, /cron\.schedule/);
  assert.match(growthMigration, /x-profile/);
  assert.match(growthMigration, /vault\.decrypted_secrets/);
  assert.doesNotMatch(growthMigration, /service_role.{0,10}eyJ|sb_secret_/i);
});

test("x-profile accepts a trusted cron call (service-role bearer) without requiring an interactive user session", () => {
  assert.match(xProfileEdge, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(xProfileEdge, /isCron/);
  assert.match(xProfileEdge, /eq\("slug", "tellus"\)/);
});

test("Resumen shows a minimal trend chart and a monthly-growth goal per platform", () => {
  assert.match(app, /function lineChart/);
  assert.match(app, /function monthlyGrowth/);
  assert.match(app, /target_monthly_growth/);
  assert.match(app, /class="trend-chart"/);
  assert.match(app, /stroke-width="2"/);
  assert.match(app, /role="img"/);
});

test("x-search never re-surfaces posts already captured, in either mode", () => {
  assert.match(xSearchEdge, /const dropAlreadyCaptured = async/);
  assert.match(xSearchEdge, /\.select\("url"\)/);
  assert.match(xSearchEdge, /\.in\("url", urls\)/);
  const modeOneUpsert = xSearchEdge.match(/Mode 1[\s\S]*?return json\(\{ saved: deduped\.length, posts: deduped \}\);/)?.[0];
  const modeTwoUpsert = xSearchEdge.match(/Mode 2[\s\S]*?return json\(\{ saved: deduped\.length,[\s\S]*?\}\);/)?.[0];
  assert.ok(modeOneUpsert, "mode 1 block not found");
  assert.ok(modeTwoUpsert, "mode 2 block not found");
  assert.match(modeOneUpsert, /dropAlreadyCaptured/);
  assert.match(modeTwoUpsert, /dropAlreadyCaptured/);
});

test("Feed has a bulk-delete button for scraped posts that leaves manual captures alone", () => {
  assert.match(app, /id="clear-scraped"/);
  assert.match(app, /Borrar todos los capturados/);
  const handler = app.match(/#clear-scraped[\s\S]*?\}\);/)?.[0];
  assert.ok(handler, "clear-scraped handler not found");
  assert.match(handler, /\.eq\("source", "scraper"\)/);
  assert.match(handler, /confirm\(/);
});

test("summary is the landing view and refreshes all three accounts with one button", () => {
  assert.match(app, /view: "summary"/);
  assert.match(app, /summary-refresh-all/);
  assert.match(app, /refresh: "all"/);
  assert.doesNotMatch(app, /summary-refresh-x/);
});

test("x-profile refreshes instagram and linkedin via public meta tags, tolerating per-platform failures", () => {
  assert.match(xProfileEdge, /function igFollowers/);
  assert.match(xProfileEdge, /function liFollowers/);
  assert.match(xProfileEdge, /og:description/);
  assert.match(xProfileEdge, /refreshAll = isCron \|\| body\.refresh === "all"/);
  assert.match(xProfileEdge, /warnings/);
  assert.match(xProfileEdge, /function parseCompact/);
});

test("daily cron refreshes all platforms and default growth goals are +200/month", () => {
  assert.match(refreshAllMigration, /'refresh', 'all'/);
  assert.match(refreshAllMigration, /target_monthly_growth/);
  assert.match(refreshAllMigration, /200/);
  assert.match(refreshAllMigration, /vault\.decrypted_secrets/);
});

test("trend chart draws a dashed goal line from the monthly growth target", () => {
  const chartFn = app.match(/function lineChart[\s\S]*?\n  \}/)?.[0];
  assert.ok(chartFn, "lineChart not found");
  assert.match(chartFn, /stroke-dasharray/);
  assert.match(chartFn, /goalTarget/);
  assert.match(chartFn, /baseline \+ goalTarget/);
});

test("meme bank: top-of-day reddit memes can be saved, used, and discarded", () => {
  assert.match(redditEdge, /body\.mode === "top"/);
  assert.match(redditEdge, /function topRedditMemes/);
  assert.match(redditEdge, /over_18/);
  assert.match(app, /data-top-memes/);
  assert.match(app, /data-save-meme/);
  assert.match(app, /meme_picks/);
  assert.match(app, /data-pick-post/);
  assert.match(app, /data-pick-used/);
});

test("meme_picks table is RLS-scoped like the rest", () => {
  assert.match(refreshAllMigration, /alter table public\.meme_picks enable row level security/);
  assert.match(refreshAllMigration, /meme_picks_member_all[\s\S]*?m\.role <> 'viewer'/);
});

test("articles hyperlink every mentioned entity to its official site, in both generate and rewrite flows", () => {
  assert.match(edge, /function inlineLinkRules/);
  assert.match(edge, /https:\/\/stellar\.org/);
  assert.match(edge, /primera mención|first mention/i);
  const genFn = edge.match(/async function generateOne[\s\S]*?\n\}/)?.[0];
  const rewriteFn = edge.match(/async function rewriteArticle[\s\S]*?\n\}/)?.[0];
  assert.ok(genFn, "generateOne not found");
  assert.ok(rewriteFn, "rewriteArticle not found");
  assert.match(genFn, /inlineLinkRules\(lang\)/);
  assert.match(rewriteFn, /inlineLinkRules\(lang\)/);
});

test("rewrite_article mode reuses the user's template on pasted source text, any language, no fresh search", () => {
  assert.match(edge, /body\.format === "rewrite_article"/);
  assert.match(edge, /async function rewriteArticle/);
  assert.match(edge, /No hagas una búsqueda nueva/);
  assert.match(app, /format: "rewrite_article"/);
  assert.match(app, /rewrite-form/);
});
