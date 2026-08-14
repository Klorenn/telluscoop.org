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

- Public marketing site (`index.html`) — no-bundler React 18 + Babel prototype, in-browser JSX transpilation, bilingual (English/Spanish via `i18n.js`).
- `brand.html` — public brand guidelines page.
- `ops/stellar/` — private Stellar Ops compliance dashboard for the Chile Stellar Ambassador Program SOW; separate vanilla-JS stack, Supabase-backed, auth-gated (not part of the public marketing surface).
- Deploys to Vercel (telluscoop.org) as static files plus serverless functions (`api/subscribe.js` for Beehiiv newsletter, Supabase Edge Functions for Luma events and first-access).

## Capabilities and Constraints

- Newsletter signup via Beehiiv (`api/subscribe.js`).
- Live events pulled from Luma calendar API via Supabase Edge Function (server-side key, public metadata + aggregate counts only).
- Design-tweaks shell (`tweaks-panel.jsx`) and `<image-slot>` custom element for drag-and-drop image fills — both are authoring/editing tooling for the omelette design host, not end-user-facing product features.
- No bundler, no TypeScript, no lint step. Tests are `node --test`.

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
