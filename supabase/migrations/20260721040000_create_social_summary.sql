-- Ops/Social — Resumen (seguidores, metas y frecuencia de posteo propia)

create table public.social_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  platform text not null check (platform in ('x', 'linkedin', 'instagram')),
  followers numeric not null check (followers >= 0),
  source text not null default 'manual' check (source in ('manual', 'scraper')),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  captured_at timestamptz not null default now()
);
create index social_metrics_org_idx on public.social_metrics(organization_id, platform, captured_at desc);

create table public.social_goals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  platform text not null check (platform in ('x', 'linkedin', 'instagram')),
  target_followers numeric check (target_followers >= 0),
  target_posts_per_week numeric check (target_posts_per_week >= 0),
  updated_at timestamptz not null default now(),
  unique (organization_id, platform)
);

create trigger social_goals_touch before update on public.social_goals for each row execute function public.touch_updated_at();

alter table public.social_metrics enable row level security;
alter table public.social_goals enable row level security;

create policy social_metrics_member_select on public.social_metrics for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = social_metrics.organization_id and m.user_id = (select auth.uid())));
create policy social_metrics_member_all on public.social_metrics for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = social_metrics.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = social_metrics.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));

create policy social_goals_member_select on public.social_goals for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = social_goals.organization_id and m.user_id = (select auth.uid())));
create policy social_goals_member_all on public.social_goals for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = social_goals.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = social_goals.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));

grant select, insert on public.social_metrics to authenticated;
grant select, insert, update on public.social_goals to authenticated;

-- Cuentas propias en LinkedIn e Instagram (X ya existe desde 20260717120000).
with org as (select id from public.organizations where slug = 'tellus')
insert into public.social_accounts (organization_id, platform, handle, display_name, category, url)
select org.id, a.platform, a.handle, a.display_name, 'tellus-own', a.url
from org cross join (values
  ('linkedin', 'tellus-cooperative', 'Tellus Cooperative', 'https://www.linkedin.com/company/tellus-cooperative'),
  ('instagram', 'telluscoop', 'Tellus Cooperative', 'https://www.instagram.com/telluscoop')
) as a(platform, handle, display_name, url)
on conflict (organization_id, platform, handle) do nothing;
