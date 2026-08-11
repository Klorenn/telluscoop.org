-- Ops/Social — listas de prospectos para follow asistido.
-- El follow lo confirma un humano en X (la sesión del scraper es de solo
-- lectura y automatizar follows quema la cuenta); acá solo guardamos a quién
-- queremos seguir, en qué lista, y si ya lo seguimos.

create table public.follow_targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  list_name text not null default 'Prospectos',
  handle text not null,
  display_name text,
  bio text,
  followers numeric not null default 0 check (followers >= 0),
  source_handle text,
  status text not null default 'pending' check (status in ('pending', 'followed', 'skipped')),
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, list_name, handle)
);
create index follow_targets_org_idx on public.follow_targets(organization_id, list_name, status);

create trigger follow_targets_touch before update on public.follow_targets for each row execute function public.touch_updated_at();

alter table public.follow_targets enable row level security;

create policy follow_targets_member_select on public.follow_targets for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = follow_targets.organization_id and m.user_id = (select auth.uid())));
create policy follow_targets_member_all on public.follow_targets for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = follow_targets.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = follow_targets.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));

grant select, insert, update, delete on public.follow_targets to authenticated;
