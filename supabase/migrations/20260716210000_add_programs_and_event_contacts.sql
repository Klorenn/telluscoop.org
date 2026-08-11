create table public.programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

alter table public.initiatives
  add column program_id uuid references public.programs(id) on delete set null;
create index initiatives_program_idx on public.initiatives(program_id);

create table public.event_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  initiative_id uuid not null references public.initiatives(id) on delete cascade,
  email text not null check (email = lower(trim(email))),
  full_name text,
  attendance_status text not null default 'registered' check (attendance_status in ('registered','attended','no_show')),
  consent_recorded boolean not null default false,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);
create unique index event_contacts_initiative_email_unique on public.event_contacts(initiative_id, email);
create index event_contacts_org_idx on public.event_contacts(organization_id, initiative_id);

insert into public.programs (organization_id, code, name)
select o.id, p.code, p.name
from public.organizations o
cross join (values
  ('stellar_chile','Stellar Chile'),
  ('stellar_barrio','Stellar Barrio'),
  ('stellar_academy','Stellar Academy'),
  ('coffee_breaks','Coffee Breaks')
) p(code,name)
where o.slug = 'tellus'
on conflict (organization_id, code) do nothing;

update public.initiatives i
set program_id = p.id
from public.programs p
where i.organization_id = p.organization_id and p.code = 'stellar_chile' and i.program_id is null;

alter table public.programs enable row level security;
alter table public.event_contacts enable row level security;

create policy programs_member_select on public.programs for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = programs.organization_id and m.user_id = (select auth.uid())));
create policy programs_admin_all on public.programs for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = programs.organization_id and m.user_id = (select auth.uid()) and m.role = 'admin'))
with check (exists (select 1 from public.organization_members m where m.organization_id = programs.organization_id and m.user_id = (select auth.uid()) and m.role = 'admin'));

create policy event_contacts_member_all on public.event_contacts for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = event_contacts.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = event_contacts.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));
create policy event_contacts_member_select on public.event_contacts for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = event_contacts.organization_id and m.user_id = (select auth.uid())));

grant select on public.programs, public.event_contacts to authenticated;
grant insert, update, delete on public.programs, public.event_contacts to authenticated;
