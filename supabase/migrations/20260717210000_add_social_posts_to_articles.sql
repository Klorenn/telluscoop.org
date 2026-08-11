-- Persist generated social posts (X/WhatsApp/LinkedIn) with the article so the
-- team can reopen them anytime instead of regenerating.
alter table public.articles
  add column if not exists social_posts jsonb,
  add column if not exists social_link text;
