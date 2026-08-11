alter table public.metric_definitions add column program_id uuid references public.programs(id) on delete cascade;
alter table public.fund_transactions add column program_id uuid references public.programs(id) on delete set null;
alter table public.evidence add column program_id uuid references public.programs(id) on delete cascade;

update public.metric_definitions m set program_id = p.id
from public.programs p where p.organization_id = m.organization_id and p.code = 'stellar_chile' and m.program_id is null;
update public.fund_transactions f set program_id = p.id
from public.programs p where p.organization_id = f.organization_id and p.code = 'stellar_chile' and f.program_id is null;

create index metric_definitions_program_idx on public.metric_definitions(program_id, sort_order);
create index fund_transactions_program_idx on public.fund_transactions(program_id, occurred_on);
create index evidence_program_idx on public.evidence(program_id, created_at);

create table public.program_budgets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  period_id uuid not null references public.reporting_periods(id) on delete cascade,
  allocated_usd numeric(12,2) not null default 0 check (allocated_usd >= 0),
  notes text,
  updated_at timestamptz not null default now(),
  unique (program_id, period_id)
);

create table public.program_resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  title text not null,
  resource_type text not null default 'other' check (resource_type in ('google_sheets','google_drive','notion','form','presentation','github','other')),
  url text not null check (url ~ '^https?://'),
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index program_resources_program_idx on public.program_resources(program_id, created_at desc);

alter table public.program_budgets enable row level security;
alter table public.program_resources enable row level security;

create policy program_budgets_member_select on public.program_budgets for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = program_budgets.organization_id and m.user_id = (select auth.uid())));
create policy program_budgets_editor_all on public.program_budgets for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = program_budgets.organization_id and m.user_id = (select auth.uid()) and m.role in ('admin','finance')))
with check (exists (select 1 from public.organization_members m where m.organization_id = program_budgets.organization_id and m.user_id = (select auth.uid()) and m.role in ('admin','finance')));

create policy program_resources_member_select on public.program_resources for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = program_resources.organization_id and m.user_id = (select auth.uid())));
create policy program_resources_editor_all on public.program_resources for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = program_resources.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = program_resources.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));

grant select on public.program_budgets, public.program_resources to authenticated;
grant insert, update, delete on public.program_budgets, public.program_resources to authenticated;
