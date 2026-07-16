# Tellus Stellar Ops

Private compliance dashboard for the Chile Stellar Ambassador Program SOW.

## Route

The application is served as a self-contained static route at `/ops/stellar/`. The public homepage and the existing `/stellar/` redirect are not modified.

## Local preview

```bash
npm run dev
```

Open `http://localhost:8080/ops/stellar/?preview=1` for the clearly labeled contract preview. Open `/ops/stellar/` for live Supabase Auth and data.

## Supabase setup

1. Apply `supabase/migrations/20260716183821_create_stellar_ops_dashboard.sql` to project `rhzanxzoqmbxptvxgnfj`.
2. Authorize team emails in the private allowlist before they request access.
3. Send each authorized user their first magic link from the dashboard.
4. Add `https://telluscoop.org/ops/stellar/` to the Auth redirect allow list.
5. Add the two public environment variables to Vercel. Never add a service-role key to frontend code.

The initial master administrators are `hola@telluscoop.org`, `kohcuendedani@gmail.com`, `mishekoh@gmail.com`, and `bastian@telluscoop.org`. The private Auth trigger assigns authorized addresses to Tellus automatically. On first access through a magic link, the dashboard requires a password of at least 10 characters and stores it through Supabase Auth; subsequent access uses email and password.

## Security model

- Every exposed application table has RLS enabled.
- Membership is scoped by organization.
- Viewer accounts are read-only.
- Finance writes are restricted to `admin` and `finance` roles.
- Evidence files live in a private bucket and are scoped to the member organization.
- The publishable key is intentionally public; authorization is enforced by RLS.

## Current modules

- Monthly KPI overview and risk status
- Activities pipeline
- Contract deliverables and acceptance status
- Payment milestones
- Operating-fund ledger
- Authenticated and responsive UI
- Secure Luma event import with registration and check-in totals

## Luma connection

The `luma-events` Edge Function keeps the calendar API key out of the browser and only returns event metadata and aggregate counts. It requires a Luma Plus calendar API key stored as the Supabase secret `LUMA_API_KEY`. Never place this key in `config.js`, `.env.local`, or Git.

If a key has been pasted into a chat or other public surface, revoke it in Luma under **Calendar → Settings → Developer**, create a replacement, and add only the replacement in **Supabase → Edge Functions → Secrets**.
