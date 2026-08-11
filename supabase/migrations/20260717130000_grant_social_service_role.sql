-- The initial Stellar Ops migration recreated the public schema and granted
-- table privileges only to `authenticated`, so `service_role` (used by the
-- social scraper worker) has schema usage but no table privileges and hits
-- "permission denied". service_role bypasses RLS, so table GRANTs are all it
-- needs. Scope stays narrow: read organizations, full access to social tables.

grant select on public.organizations to service_role;
grant select, insert, update, delete on
  public.social_accounts, public.social_posts, public.repo_picks
  to service_role;
