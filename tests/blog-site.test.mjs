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

test("official /brand logos replace recreated lockups; CTAs are Clay pills", async () => {
  const logo = await read("src/components/Logo.tsx");
  const header = await read("src/components/Header.tsx");
  const footer = await read("src/components/Footer.tsx");
  const home = await read("src/app/page.tsx");
  const layout = await read("src/app/layout.tsx");
  const css = await read("src/app/globals.css");
  const form = await read("src/components/SubscribeForm.tsx");
  assert.match(logo, /logo-dark\.svg/);
  assert.match(logo, /logo-color\.svg/);
  assert.match(logo, /logo-white\.svg/);
  assert.match(logo, /logo-icon\.png/);
  assert.doesNotMatch(logo, /logo-stacked-serif/);
  assert.doesNotMatch(logo, /logo-horizontal/);
  assert.doesNotMatch(logo, /logo-mark-tau/);
  assert.match(header, /min-w-\[120px\]/);
  assert.match(header, /cta-pill/);
  assert.match(footer, /variant="white"/);
  assert.match(footer, /min-w-\[120px\]/);
  assert.match(layout, /Fraunces/);
  assert.doesNotMatch(layout, /Figtree/);
  assert.match(css, /#ece0cc/i);
  assert.match(css, /#3f8487/i);
  assert.match(css, /#c75a2a/i);
  assert.match(css, /#1f3536/i);
  assert.match(css, /#2a5a5c/i);
  assert.match(css, /#9e441f/i);
  assert.doesNotMatch(css, /#ffffff/);
  assert.doesNotMatch(css, /#bedada/);
  assert.doesNotMatch(css, /#cfe8e6/);
  assert.match(form, /cta-pill/);
  assert.doesNotMatch(form, /mint-btn/);
  assert.ok(existsSync(new URL("public/brand/logo-dark.svg", root)));
  assert.ok(existsSync(new URL("public/brand/logo-color.svg", root)));
  assert.ok(existsSync(new URL("public/brand/logo-white.svg", root)));
  assert.ok(existsSync(new URL("public/brand/logo-icon.png", root)));
  assert.ok(!existsSync(new URL("public/brand/logo-horizontal.webp", root)));
  assert.ok(!existsSync(new URL("public/brand/logo-stacked-serif-black.svg", root)));
  assert.ok(!existsSync(new URL("public/brand/tellus-logo.png", root)));
  assert.ok(existsSync(new URL("src/app/icon.png", root)));
  assert.doesNotMatch(home, /mapa-latam/);
  assert.doesNotMatch(home, /planetas-botas/);
  assert.match(home, /name="hero"/);
});

test("characters are not scattered; only 404 uses a Figma mascot", async () => {
  const home = await read("src/app/page.tsx");
  const footer = await read("src/components/Footer.tsx");
  const archive = await read("src/app/archive/page.tsx");
  const tag = await read("src/app/t/[slug]/page.tsx");
  const post = await read("src/app/p/[slug]/page.tsx");
  const card = await read("src/components/SubscribeCard.tsx");
  const notFound = await read("src/app/not-found.tsx");
  const character = await read("src/components/Character.tsx");
  for (const src of [home, footer, archive, tag, post, card]) {
    assert.doesNotMatch(src, /from "@\/components\/Character"/);
    assert.doesNotMatch(src, /planetas-botas|mapa-latam|greenpill|tierra-corbata/);
  }
  assert.match(home, /Illustration/);
  assert.match(home, /illo-hero|name="hero"/);
  assert.match(notFound, /robot-espacio/);
  assert.match(character, /robot-espacio/);
  assert.doesNotMatch(character, /greenpill|planetas|tierra-corbata|crecimiento|educacion/);
  assert.ok(!existsSync(new URL("public/brand/personaje-planetas-botas.webp", root)));
  assert.ok(!existsSync(new URL("public/brand/personaje-greenpill-pastillas.webp", root)));
  assert.ok(!existsSync(new URL("public/brand/mapa-latam.webp", root)));
  assert.ok(existsSync(new URL("public/brand/personaje-robot-espacio.webp", root)));
  assert.ok(existsSync(new URL("public/brand/illo-hero.svg", root)));
  assert.ok(existsSync(new URL("public/brand/illo-subscribe.svg", root)));
  assert.ok(existsSync(new URL("public/brand/illo-stellar.svg", root)));
});

test("vercel.json asks Vercel to build Next.js without dropping existing redirects", async () => {
  const vercel = JSON.parse(await read("vercel.json"));
  assert.equal(vercel.framework, "nextjs");
  assert.equal(vercel.buildCommand, "npm run build");
  assert.ok(vercel.redirects.some((r) => r.source === "/tierly"));
  assert.ok(Array.isArray(vercel.rewrites));
  assert.ok(vercel.rewrites.some((r) => r.source === "/brand" && r.destination === "/brand.html"));
});
