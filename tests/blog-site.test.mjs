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

test("official /brand logos stay; chrome matches Milk Road colors", async () => {
  const logo = await read("src/components/Logo.tsx");
  const header = await read("src/components/Header.tsx");
  const footer = await read("src/components/Footer.tsx");
  const home = await read("src/app/page.tsx");
  const layout = await read("src/app/layout.tsx");
  const css = await read("src/app/globals.css");
  const form = await read("src/components/SubscribeForm.tsx");
  const ticker = await read("src/components/PriceTicker.tsx");
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
  assert.doesNotMatch(footer, /\/hub/);
  assert.doesNotMatch(header, /\/hub/);
  assert.doesNotMatch(home, /\/hub|Hub Santiago|HubBanner|Hub Tellus/);
  assert.doesNotMatch(ticker, /Hub Santiago|\/hub/);
  assert.match(layout, /Fraunces/);
  assert.doesNotMatch(layout, /Figtree/);
  assert.match(layout, /themeColor: "#ffffff"/);
  assert.match(css, /#ffffff/i);
  assert.match(css, /#bedada/i);
  assert.match(css, /#b6e6f4/i);
  assert.match(css, /#22c55e/i);
  assert.match(css, /#ef4444/i);
  assert.match(css, /#f0c93d/i);
  assert.doesNotMatch(css, /#ece0cc/i);
  assert.doesNotMatch(css, /#c75a2a/i);
  assert.match(form, /cta-pill/);
  assert.match(css, /mint-btn/);
  assert.ok(existsSync(new URL("public/brand/logo-dark.svg", root)));
  assert.ok(existsSync(new URL("public/brand/logo-color.svg", root)));
  assert.ok(existsSync(new URL("public/brand/logo-white.svg", root)));
  assert.ok(existsSync(new URL("public/brand/logo-icon.png", root)));
  assert.ok(!existsSync(new URL("public/brand/logo-horizontal.webp", root)));
  assert.ok(!existsSync(new URL("public/brand/logo-stacked-serif-black.svg", root)));
  assert.ok(!existsSync(new URL("public/brand/tellus-logo.png", root)));
  assert.ok(!existsSync(new URL("public/brand/illo-hero.svg", root)));
  assert.ok(existsSync(new URL("src/app/icon.png", root)));
  assert.doesNotMatch(home, /mapa-latam/);
  assert.doesNotMatch(home, /planetas-botas/);
  assert.match(home, /robot-teal/);
});

test("Figma pack fills Milk Road illustration slots; no invented drawings", async () => {
  const home = await read("src/app/page.tsx");
  const footer = await read("src/components/Footer.tsx");
  const archive = await read("src/app/archive/page.tsx");
  const tag = await read("src/app/t/[slug]/page.tsx");
  const post = await read("src/app/p/[slug]/page.tsx");
  const card = await read("src/components/SubscribeCard.tsx");
  const notFound = await read("src/app/not-found.tsx");
  const character = await read("src/components/Character.tsx");
  for (const src of [home, footer, archive, tag, post, card, notFound, character]) {
    assert.doesNotMatch(src, /illo-hero|illo-subscribe|illo-archive|illo-hub|HubBanner/);
    assert.doesNotMatch(src, /mapa-latam/);
  }
  assert.doesNotMatch(home, /planetas-botas/);
  assert.match(home, /robot-teal/);
  assert.match(home, /tierra-traje/);
  assert.match(card, /greenpill/);
  assert.match(footer, /tierra-corbata/);
  assert.match(character, /educacion/);
  assert.match(character, /inclusion/);
  assert.match(character, /crecimiento/);
  assert.match(notFound, /robot-espacio/);
  assert.ok(existsSync(new URL("public/brand/personaje-robot-teal.png", root)));
  assert.ok(existsSync(new URL("public/brand/personaje-tierra-traje.png", root)));
  assert.ok(existsSync(new URL("public/brand/personaje-tierra-corbata.png", root)));
  assert.ok(existsSync(new URL("public/brand/personaje-tierra.png", root)));
  assert.ok(existsSync(new URL("public/brand/personaje-greenpill-pastillas.png", root)));
  assert.ok(existsSync(new URL("public/brand/personaje-planetas-botas.png", root)));
  assert.ok(existsSync(new URL("public/brand/personaje-robot-espacio.png", root)));
  assert.ok(existsSync(new URL("public/brand/ilustracion-educacion.svg", root)));
  assert.ok(existsSync(new URL("public/brand/ilustracion-inclusion.svg", root)));
  assert.ok(existsSync(new URL("public/brand/ilustracion-crecimiento.svg", root)));
  assert.ok(!existsSync(new URL("src/components/Illustration.tsx", root)));
  assert.ok(!existsSync(new URL("src/components/HubBanner.tsx", root)));
});

test("vercel.json asks Vercel to build Next.js without dropping existing redirects", async () => {
  const vercel = JSON.parse(await read("vercel.json"));
  assert.equal(vercel.framework, "nextjs");
  assert.equal(vercel.buildCommand, "npm run build");
  assert.ok(vercel.redirects.some((r) => r.source === "/tierly"));
  assert.ok(Array.isArray(vercel.rewrites));
  assert.ok(vercel.rewrites.some((r) => r.source === "/brand" && r.destination === "/brand.html"));
});
