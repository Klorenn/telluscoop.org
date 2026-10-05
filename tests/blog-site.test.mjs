import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const root = new URL("../", import.meta.url);

const read = (rel) => readFile(new URL(rel, root), "utf8");

test("content snapshot has posts and 44 accent-slug redirects", async () => {
  const snap = JSON.parse(await read("content/cache/snapshot.json"));
  const redirects = JSON.parse(await read("content/cache/redirects.json"));
  assert.ok(snap.posts.length >= 100, `expected many posts, got ${snap.posts.length}`);
  assert.equal(Object.keys(redirects).length, 44);
  for (const [from, to] of Object.entries(redirects)) {
    assert.notEqual(from, to);
    assert.ok(snap.posts.some((p) => p.sourceSlug === from && p.slug === to), `missing mapping ${from} -> ${to}`);
  }
  const slugs = new Set(snap.posts.map((p) => p.slug));
  assert.equal(slugs.size, snap.posts.length, "canonical slugs must be unique");
});

test("next.config registers 301s for broken-accent slugs and existing static rewrites", async () => {
  const cfg = await read("next.config.ts");
  assert.match(cfg, /redirects\.json/);
  assert.match(cfg, /statusCode: 301/);
  assert.match(cfg, /source: `\/p\/\$\{from\}`/);
  assert.match(cfg, /destination: "\/brand.html"/);
  assert.match(cfg, /destination: "\/hub\/index.html"/);
  assert.match(cfg, /destination: "\/ops\/stellar\/index.html"/);
  assert.match(cfg, /destination: "\/resources\/index.html"/);
});

test("subscribe route uses Beehiiv when keyed and fails in Spanish without a key", async () => {
  const src = await read("src/app/api/subscribe/route.ts");
  assert.match(src, /BEEHIIV_API_KEY/);
  assert.match(src, /utm_medium: placement/);
  assert.match(src, /utm_source: "telluscoop.org"/);
  assert.match(src, /pub_30c7e4c1-15ed-46d8-a23d-32c90e011794/);
  assert.match(src, /El boletín no está disponible en este momento/);
  assert.match(src, /status: 503/);
  assert.doesNotMatch(src, /Server misconfigured/);
});

test("previews are noindex unless SITE_ENV=production", async () => {
  const robots = await read("src/app/robots.ts");
  const layout = await read("src/app/layout.tsx");
  const site = await read("src/lib/site.ts");
  assert.match(site, /SITE_ENV === "production"/);
  assert.match(robots, /isProductionIndexable/);
  assert.match(layout, /isProductionIndexable/);
  assert.match(layout, /lang="es"/);
  assert.match(layout, /index: false, follow: false/);
  assert.match(layout, /index: true, follow: true/);
});

test("canonical site url is telluscoop.org and RSS/sitemap exist", async () => {
  const site = await read("src/lib/site.ts");
  assert.match(site, /https:\/\/telluscoop.org/);
  assert.ok(existsSync(new URL("src/app/sitemap.ts", root)));
  assert.ok(existsSync(new URL("src/app/feed.xml/route.ts", root)));
  assert.ok(existsSync(new URL("src/app/archive/page.tsx", root)));
  assert.ok(existsSync(new URL("src/app/p/[slug]/page.tsx", root)));
  assert.ok(existsSync(new URL("src/app/t/[slug]/page.tsx", root)));
  assert.ok(existsSync(new URL("src/app/api/luma-events/route.ts", root)));
});

test("primary logo is stacked serif with terracotta disc; tau mark is compact/favicon", async () => {
  const logo = await read("src/components/Logo.tsx");
  const header = await read("src/components/Header.tsx");
  const footer = await read("src/components/Footer.tsx");
  assert.match(logo, /logo-stacked-serif-black\.svg/);
  assert.match(logo, /logo-stacked-serif-white\.svg/);
  assert.match(logo, /logo-stacked-serif-teal\.svg/);
  assert.match(logo, /logo-mark-tau-/);
  assert.doesNotMatch(logo, /logo-horizontal\.webp/);
  assert.match(header, /Logo className="hidden h-\[42px\]/);
  assert.match(header, /mark variant="teal"/);
  assert.match(footer, /variant="white"/);
  for (const v of ["black", "teal", "white"]) {
    const svg = await read(`public/brand/logo-stacked-serif-${v}.svg`);
    assert.match(svg, /#B3582D/);
    assert.doesNotMatch(svg, /#B65A30/);
  }
  assert.ok(existsSync(new URL("public/brand/personaje-planetas-botas.webp", root)));
  assert.ok(existsSync(new URL("public/brand/personaje-tierra.webp", root)));
  assert.ok(existsSync(new URL("src/app/icon.png", root)));
});

test("vercel.json asks Vercel to build Next.js without dropping existing redirects", async () => {
  const vercel = JSON.parse(await read("vercel.json"));
  assert.equal(vercel.framework, "nextjs");
  assert.equal(vercel.buildCommand, "npm run build");
  assert.ok(vercel.redirects.some((r) => r.source === "/tierly"));
  assert.ok(Array.isArray(vercel.rewrites));
  assert.ok(vercel.rewrites.some((r) => r.source === "/brand" && r.destination === "/brand.html"));
});
