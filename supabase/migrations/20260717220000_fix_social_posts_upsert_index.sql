-- The partial unique index (where url is not null) cannot back
-- ON CONFLICT (organization_id, url) from supabase-js, which broke the
-- x-search upsert. Replace with a full unique index: Postgres treats NULLs
-- as distinct, so url-less manual rows keep working.

-- Dedupe first so the unique index can build.
delete from public.social_posts a
  using public.social_posts b
  where a.id > b.id
    and a.organization_id = b.organization_id
    and a.url = b.url
    and a.url is not null;

drop index if exists public.social_posts_org_url_idx;
create unique index social_posts_org_url_idx
  on public.social_posts(organization_id, url);
