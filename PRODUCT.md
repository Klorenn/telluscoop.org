# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Four audiences, all served by telluscoop.org:
- **Prospective members** — LatAm people/devs deciding whether to join a Tellus chapter or program.
- **Existing members** — current cooperative members checking events, resources, or ops (Stellar Ops dashboard, private).
- **Ecosystem builders** — developers/founders looking for incubation support or resources.
- **Partners, funders, and press** — organizations and media evaluating Tellus's credibility and track record.

## Product Purpose

Tellus Cooperative is Latin American cooperative blockchain education, project incubation, and public resources. It exists to take people from learning blockchain to building and shipping a project, with cooperative (member-owned) structure rather than a company or foundation-only nonprofit model.

## Positioning

The education-to-incubation pipeline: learn blockchain → build a project → get incubated. This end-to-end path, combined with a member-owned cooperative governance structure, is what a neighboring education-only or community-only org could not truthfully copy.

## Operating Context

- Public blog (`src/app`) — Next.js 16 on Vercel. Home, `/p/<slug>` posts, `/archive`, `/t/<tag>`, RSS, sitemap. Content synced from Beehiiv's public site (or API when `BEEHIIV_API_KEY` + `CONTENT_SOURCE=beehiivApi`).
- `index.html` / `foundation.jsx` — leftover no-bundler design-host prototype; not the live homepage.
- `brand.html` — public brand guidelines page (`/brand`).
- `ops/stellar/` — private Stellar Ops compliance dashboard for the Chile Stellar Ambassador Program SOW; separate vanilla-JS stack, Supabase-backed, auth-gated (not part of the public marketing surface).
- Deploys to Vercel (telluscoop.org) as Next.js plus copied static apps. Newsletter signup is `src/app/api/subscribe/route.ts`.

## Capabilities and Constraints

- Newsletter signup via Beehiiv (`src/app/api/subscribe/route.ts`), with `utm_medium` per placement.
- Live events pulled from Luma calendar API via `/api/luma-events` and the Supabase Edge Function (server-side key, public metadata + aggregate counts only).
- Design-tweaks shell (`tweaks-panel.jsx`) and `<image-slot>` custom element remain as authoring tooling for the omelette design host, not the live homepage.
- Public blog is Next.js 16 + TypeScript. Existing ops/hub/resources apps stay vanilla. Tests are `node --test`.

## Brand Commitments

- Legal/public name: **Tellus Cooperative Foundation** (site title: "Tellus Cooperative — Blockchain Latin America").
- Cooperative structure is a binding identity fact, not just a tagline — governance/ownership language should stay accurate to it.

## Evidence on Hand

- Public claim: 4,500+ members across 12 chapters (from site meta description — current source of truth; no additional specifics confirmed at this time).
- No additional partner names, exact chapter list, or other figures confirmed beyond what's already public on the site. Future work must not fabricate testimonials, named partners, or numbers beyond this.

## Product Principles

- Cooperative, not corporate: governance and ownership framing must stay member-owned, not company-style.
- The pipeline is the pitch: education, incubation, and resources should read as one continuous path, not three disconnected offerings.
- Serve four distinct jobs from one site: don't let any single audience (e.g. press) crowd out the others' primary tasks.
- Public surface stays public: `ops/stellar/` is a separate, auth-gated product and should not blur into the marketing site's design language or claims.
