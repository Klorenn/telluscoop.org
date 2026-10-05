# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with this repository.

## Commands

```bash
npm run dev        # Next.js blog + staged static apps at http://localhost:8080
npm run dev:static # old no-bundler foundation SPA (index.html) via `serve`
npm run sync       # refresh Beehiiv content cache (`SKIP_SYNC=1` to skip)
npm run build      # stage static apps + sync (if cache stale) + next build
npm test           # node --test tests/*.test.mjs
```

The public site is Next.js 16 (App Router) on Vercel project `telluscoop-org`. Existing static apps (`ops/`, `hub/`, `resources/`, `tools/`, `merch/`, `brand.html`) stay in place and are copied into `public/` at build time by `scripts/stage-static.mjs`.

## Public blog (Next.js)

Home, posts, archive, tags, RSS, and sitemap live under `src/`. Content is a build-time snapshot of Beehiiv:

| Path | Purpose |
|---|---|
| `src/app/page.tsx` | Blog home |
| `src/app/p/[slug]/page.tsx` | Post pages (`/p/<slug>`, same slugs as blog.telluscoop.com) |
| `src/app/archive/page.tsx` | Searchable archive |
| `src/app/t/[slug]/page.tsx` | Category pages |
| `src/app/feed.xml/route.ts` | RSS |
| `src/app/sitemap.ts` | Sitemap (home, archive, tags, posts) |
| `src/app/robots.ts` | `noindex` unless `SITE_ENV=production` |
| `src/app/api/subscribe/route.ts` | Beehiiv newsletter signup |
| `src/app/api/luma-events/route.ts` | Existing Luma calendar proxy used by `/hub` |
| `content/cache/snapshot.json` | Normalized posts (SSG source of truth) |
| `content/cache/redirects.json` | 44 broken-accent slug → clean slug 301s |
| `scripts/sync-content.ts` | Public Beehiiv scrape (default) or `CONTENT_SOURCE=beehiivApi` |

`index.html` + `foundation.jsx` remain as the omelette/design-host prototype; they are **not** the live homepage.

### Indexing

Previews stay `noindex`. Production becomes indexable only when Vercel env `SITE_ENV=production` is set (Production environment only — do not set it on Preview).

### Newsletter

`POST /api/subscribe` sends `utm_source=telluscoop.org` and `utm_medium=<placement>` (`hero`, `inline`, `end`, `sticky`, `band`, `footer`). If `BEEHIIV_API_KEY` is missing it returns a Spanish 503 and does not crash.

## Existing static apps (unchanged source trees)

- `/ops/stellar/` — Stellar Ops dashboard (vanilla JS + Supabase). See `ops/stellar/README.md`. Cache-bust `?v=` on `app.js` and `styles.css` together.
- `/ops/merch/`, `/ops/social/`, `/ops/tierly/`
- `/hub`, `/resources`, `/tools/fear-greed`, `/brand`, `/merch`, `/stellar`

## Supabase backend (`supabase/`)

- `migrations/` — Stellar Ops schema (RLS, org-scoped membership, role-restricted finance writes).
- `functions/first-access/` — one-time-code first login of master admins.
- `functions/luma-events/` — Luma calendar proxy; `LUMA_API_KEY` is a Supabase secret.
- Project ref: `rhzanxzoqmbxptvxgnfj`.

## Secrets

- Never put a Supabase service-role key, Luma API key, or Beehiiv API key in frontend code, `config.js`, `.env.local`, or Git.
- The Supabase publishable key in `ops/stellar/config.js` is public by design.
- `BEEHIIV_API_KEY` lives only in Vercel env vars (and optionally local `.env.local`).
