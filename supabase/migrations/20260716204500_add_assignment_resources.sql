alter table public.initiatives
  add column if not exists resource_links jsonb not null default '[]'::jsonb;

alter table public.deliverables
  add column if not exists resource_links jsonb not null default '[]'::jsonb;

alter table public.initiatives
  add constraint initiatives_resource_links_array check (jsonb_typeof(resource_links) = 'array');

alter table public.deliverables
  add constraint deliverables_resource_links_array check (jsonb_typeof(resource_links) = 'array');

create policy profiles_team_select on public.profiles for select to authenticated
using (exists (
  select 1
  from public.organization_members mine
  join public.organization_members teammate on teammate.organization_id = mine.organization_id
  where mine.user_id = (select auth.uid()) and teammate.user_id = profiles.id
));
