-- Ops/Social — temas de búsqueda automática en X.
-- El equipo define temas; el cron (worker) y el botón "Buscar ahora" (Edge
-- Function x-search) traen posts de cada tema a social_posts. Reemplaza la
-- captura manual como flujo principal del feed.

create table public.social_topics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  query text not null,
  active boolean not null default true,
  last_run_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, query)
);
create index social_topics_org_idx on public.social_topics(organization_id, active);

create trigger social_topics_touch before update on public.social_topics for each row execute function public.touch_updated_at();

alter table public.social_topics enable row level security;

create policy social_topics_member_select on public.social_topics for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = social_topics.organization_id and m.user_id = (select auth.uid())));
create policy social_topics_member_all on public.social_topics for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = social_topics.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = social_topics.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));

grant select on public.social_topics to authenticated;
grant insert, update, delete on public.social_topics to authenticated;

-- Worker (service_role) reads topics and updates last_run_at.
grant select, update on public.social_topics to service_role;

-- A few seed topics to show the flow; edit or delete freely.
with org as (select id from public.organizations where slug = 'tellus')
insert into public.social_topics (organization_id, label, query)
select org.id, t.label, t.query
from org cross join (values
  ('Stellar', 'Stellar OR Soroban lang:es'),
  ('Agentes IA', '"AI agents" OR "agentes de IA"'),
  ('Indie hacking', 'indie hacker OR "build in public"')
) as t(label, query);
