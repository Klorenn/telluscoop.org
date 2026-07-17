-- Ops/Social — analizador de contenido social (Fase 1)
-- Tablas org-scoped con el mismo modelo RLS que Stellar Ops:
-- lectura para miembros, escritura para roles distintos de viewer.

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  platform text not null check (platform in ('x', 'linkedin', 'instagram')),
  handle text not null,
  display_name text,
  category text not null default 'general',
  url text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, platform, handle)
);
create index social_accounts_org_idx on public.social_accounts(organization_id, platform, category);

create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid references public.social_accounts(id) on delete set null,
  platform text not null check (platform in ('x', 'linkedin', 'instagram')),
  author_handle text not null,
  url text,
  content text not null,
  media_url text,
  posted_at timestamptz,
  likes numeric not null default 0 check (likes >= 0),
  reposts numeric not null default 0 check (reposts >= 0),
  replies numeric not null default 0 check (replies >= 0),
  views numeric not null default 0 check (views >= 0),
  score numeric,
  analysis jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  source text not null default 'manual' check (source in ('manual', 'scraper')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index social_posts_org_idx on public.social_posts(organization_id, platform, posted_at desc);
create index social_posts_account_idx on public.social_posts(account_id);
create unique index social_posts_org_url_idx on public.social_posts(organization_id, url) where url is not null;

create table public.repo_picks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  repo_full_name text not null,
  url text not null,
  description text,
  stars numeric not null default 0 check (stars >= 0),
  language text,
  topics text[] not null default '{}',
  reason text,
  status text not null default 'inbox' check (status in ('inbox', 'reviewed', 'shared', 'discarded')),
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, repo_full_name)
);
create index repo_picks_org_idx on public.repo_picks(organization_id, status);

create trigger social_accounts_touch before update on public.social_accounts for each row execute function public.touch_updated_at();
create trigger social_posts_touch before update on public.social_posts for each row execute function public.touch_updated_at();
create trigger repo_picks_touch before update on public.repo_picks for each row execute function public.touch_updated_at();

alter table public.social_accounts enable row level security;
alter table public.social_posts enable row level security;
alter table public.repo_picks enable row level security;

create policy social_accounts_member_select on public.social_accounts for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = social_accounts.organization_id and m.user_id = (select auth.uid())));
create policy social_accounts_member_all on public.social_accounts for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = social_accounts.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = social_accounts.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));

create policy social_posts_member_select on public.social_posts for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = social_posts.organization_id and m.user_id = (select auth.uid())));
create policy social_posts_member_all on public.social_posts for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = social_posts.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = social_posts.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));

create policy repo_picks_member_select on public.repo_picks for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = repo_picks.organization_id and m.user_id = (select auth.uid())));
create policy repo_picks_member_all on public.repo_picks for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = repo_picks.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = repo_picks.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));

grant select on public.social_accounts, public.social_posts, public.repo_picks to authenticated;
grant insert, update, delete on public.social_accounts, public.social_posts, public.repo_picks to authenticated;

-- Cuentas semilla observadas en X, con su categoría editorial.
with org as (select id from public.organizations where slug = 'tellus')
insert into public.social_accounts (organization_id, platform, handle, display_name, category, url)
select org.id, 'x', a.handle, a.display_name, a.category, 'https://x.com/' || a.handle
from org cross join (values
  ('telluscoop', 'Tellus Cooperative', 'tellus-own'),
  ('midudev', 'Miguel Ángel Durán', 'ai-dev-news'),
  ('DotCSV', 'Dot CSV', 'ai-dev-news'),
  ('S0N_IA', 'SON IA', 'ai-dev-news'),
  ('nicos_ai', 'Nicos AI', 'ai-dev-news'),
  ('0xJokker', 'Jokker', 'ai-dev-news'),
  ('aresotik', 'Aresotik', 'ai-dev-news'),
  ('hqmank', 'HQ Mank', 'ai-dev-news'),
  ('angeldot_', 'Angeldot', 'ai-dev-news'),
  ('precisox', 'Precisox', 'ai-dev-news'),
  ('SantiTorAI', 'Santi Tor AI', 'ai-dev-news'),
  ('dev_gen88926', 'Dev Gen', 'memes'),
  ('marclou', 'Marc Lou', 'saas'),
  ('jackfriks', 'Jack Friks', 'micro-apps'),
  ('athcanft', 'Athcan', 'mobile-apps'),
  ('wickedguro', 'Wicked Guro', 'distribution'),
  ('levelsio', 'Pieter Levels', 'internet-business'),
  ('vitaliidodonov', 'Vitalii Dodonov', 'shipping'),
  ('robj3d3', 'Rob J3d3', 'ai-coding'),
  ('illyism', 'Illyism', 'seo'),
  ('kalashvasaniya', 'Kalash Vasaniya', 'launch'),
  ('gregisenberg', 'Greg Isenberg', 'startup-ideas'),
  ('tibo_maker', 'Tibo', 'audience'),
  ('sushilwtf', 'Sushil', 'indie-legend'),
  ('robiartec', 'Robiartec', 'repos')
) as a(handle, display_name, category);
