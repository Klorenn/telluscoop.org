-- DESTRUCTIVE PROJECT REPURPOSING
-- This migration intentionally replaces the legacy application in the dedicated
-- Supabase project with Tellus Stellar Ops. It is expected to run exactly once.
delete from auth.users;
drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

create extension if not exists pgcrypto;

create type public.member_role as enum ('admin', 'operator', 'finance', 'viewer');
create type public.work_status as enum ('not_started', 'in_progress', 'at_risk', 'submitted', 'accepted', 'blocked');
create type public.initiative_type as enum ('event', 'content', 'scf', 'instaward', 'ambassador', 'developer', 'partnership');
create type public.payment_status as enum ('not_triggered', 'triggered', 'invoiced', 'paid', 'disputed');
create type public.fund_direction as enum ('credit', 'debit');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members(user_id);

create table public.reporting_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  starts_on date not null,
  ends_on date not null,
  report_due_on date,
  status public.work_status not null default 'not_started',
  created_at timestamptz not null default now(),
  unique (organization_id, starts_on)
);
create index reporting_periods_org_idx on public.reporting_periods(organization_id, starts_on);

create table public.metric_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  label text not null,
  category text not null,
  target numeric not null check (target >= 0),
  unit text not null,
  frequency text not null default 'monthly',
  validation_method text,
  contract_note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);
create index metric_definitions_org_idx on public.metric_definitions(organization_id, sort_order);

create table public.metric_updates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_id uuid not null references public.reporting_periods(id) on delete cascade,
  metric_id uuid not null references public.metric_definitions(id) on delete cascade,
  actual numeric not null default 0 check (actual >= 0),
  status public.work_status not null default 'not_started',
  owner_id uuid references auth.users(id) on delete set null,
  notes text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (period_id, metric_id)
);
create index metric_updates_period_idx on public.metric_updates(period_id);
create index metric_updates_org_idx on public.metric_updates(organization_id);

create table public.initiatives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_id uuid references public.reporting_periods(id) on delete set null,
  type public.initiative_type not null,
  title text not null,
  status public.work_status not null default 'not_started',
  owner_id uuid references auth.users(id) on delete set null,
  due_on date,
  occurred_on date,
  count_value numeric not null default 1 check (count_value >= 0),
  details jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index initiatives_org_period_idx on public.initiatives(organization_id, period_id, type);
create index initiatives_due_idx on public.initiatives(due_on) where due_on is not null;

create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_id uuid references public.reporting_periods(id) on delete set null,
  title text not null,
  description text,
  due_on date not null,
  status public.work_status not null default 'not_started',
  owner_id uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  accepted_at timestamptz,
  correction_due_on date,
  acceptance_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index deliverables_org_due_idx on public.deliverables(organization_id, due_on);

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  initiative_id uuid references public.initiatives(id) on delete cascade,
  deliverable_id uuid references public.deliverables(id) on delete cascade,
  title text not null,
  kind text not null,
  url text,
  storage_path text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (initiative_id is not null or deliverable_id is not null),
  check (url is not null or storage_path is not null)
);
create index evidence_org_idx on public.evidence(organization_id);

create table public.payment_milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  amount_usd numeric(12,2) not null check (amount_usd >= 0),
  due_after_acceptance text,
  status public.payment_status not null default 'not_triggered',
  accepted_at timestamptz,
  paid_at timestamptz,
  xlm_received numeric,
  transaction_hash text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index payment_milestones_org_idx on public.payment_milestones(organization_id, sort_order);

create table public.fund_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  occurred_on date not null,
  direction public.fund_direction not null,
  category text not null,
  description text not null,
  amount_usd numeric(12,2) not null check (amount_usd >= 0),
  amount_xlm numeric,
  transaction_hash text,
  receipt_url text,
  approved boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index fund_transactions_org_date_idx on public.fund_transactions(organization_id, occurred_on);

create or replace function public.touch_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger metric_updates_touch before update on public.metric_updates for each row execute function public.touch_updated_at();
create trigger initiatives_touch before update on public.initiatives for each row execute function public.touch_updated_at();
create trigger deliverables_touch before update on public.deliverables for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users for each row execute function public.handle_new_user();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.reporting_periods enable row level security;
alter table public.metric_definitions enable row level security;
alter table public.metric_updates enable row level security;
alter table public.initiatives enable row level security;
alter table public.deliverables enable row level security;
alter table public.evidence enable row level security;
alter table public.payment_milestones enable row level security;
alter table public.fund_transactions enable row level security;

create policy profiles_self_select on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_self_update on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy memberships_self_select on public.organization_members for select to authenticated using ((select auth.uid()) = user_id);

create policy organizations_member_select on public.organizations for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = id and m.user_id = (select auth.uid())));

create policy periods_member_all on public.reporting_periods for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = reporting_periods.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = reporting_periods.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));
create policy periods_member_select on public.reporting_periods for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = reporting_periods.organization_id and m.user_id = (select auth.uid())));

create policy metric_definitions_member_select on public.metric_definitions for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = metric_definitions.organization_id and m.user_id = (select auth.uid())));

create policy metric_updates_member_all on public.metric_updates for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = metric_updates.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = metric_updates.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));
create policy metric_updates_member_select on public.metric_updates for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = metric_updates.organization_id and m.user_id = (select auth.uid())));

create policy initiatives_member_all on public.initiatives for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = initiatives.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = initiatives.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));
create policy initiatives_member_select on public.initiatives for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = initiatives.organization_id and m.user_id = (select auth.uid())));

create policy deliverables_member_all on public.deliverables for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = deliverables.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = deliverables.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));
create policy deliverables_member_select on public.deliverables for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = deliverables.organization_id and m.user_id = (select auth.uid())));

create policy evidence_member_all on public.evidence for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = evidence.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = evidence.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));
create policy evidence_member_select on public.evidence for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = evidence.organization_id and m.user_id = (select auth.uid())));

create policy payments_member_select on public.payment_milestones for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = payment_milestones.organization_id and m.user_id = (select auth.uid())));
create policy payments_finance_all on public.payment_milestones for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = payment_milestones.organization_id and m.user_id = (select auth.uid()) and m.role in ('admin', 'finance')))
with check (exists (select 1 from public.organization_members m where m.organization_id = payment_milestones.organization_id and m.user_id = (select auth.uid()) and m.role in ('admin', 'finance')));

create policy funds_member_select on public.fund_transactions for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = fund_transactions.organization_id and m.user_id = (select auth.uid())));
create policy funds_finance_all on public.fund_transactions for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = fund_transactions.organization_id and m.user_id = (select auth.uid()) and m.role in ('admin', 'finance')))
with check (exists (select 1 from public.organization_members m where m.organization_id = fund_transactions.organization_id and m.user_id = (select auth.uid()) and m.role in ('admin', 'finance')));

grant usage on schema public to authenticated;
grant select on public.organizations, public.profiles, public.organization_members, public.reporting_periods,
  public.metric_definitions, public.metric_updates, public.initiatives, public.deliverables,
  public.evidence, public.payment_milestones, public.fund_transactions to authenticated;
grant insert, update, delete on public.reporting_periods, public.metric_updates, public.initiatives,
  public.deliverables, public.evidence, public.payment_milestones, public.fund_transactions to authenticated;
grant update on public.profiles to authenticated;

insert into public.organizations (name, slug) values ('Tellus Cooperative Foundation', 'tellus');

with org as (select id from public.organizations where slug = 'tellus')
insert into public.reporting_periods (organization_id, label, starts_on, ends_on, report_due_on)
select org.id, p.label, p.starts_on, p.ends_on, p.report_due_on
from org cross join (values
  ('Julio 2026', date '2026-07-01', date '2026-07-31', date '2026-08-07'),
  ('Agosto 2026', date '2026-08-01', date '2026-08-31', date '2026-09-07'),
  ('Septiembre 2026', date '2026-09-01', date '2026-09-30', date '2026-10-07'),
  ('Octubre 2026', date '2026-10-01', date '2026-10-31', date '2026-11-06'),
  ('Noviembre 2026', date '2026-11-01', date '2026-11-30', date '2026-12-07'),
  ('Diciembre 2026', date '2026-12-01', date '2026-12-31', date '2027-01-08')
) as p(label, starts_on, ends_on, report_due_on);

with org as (select id from public.organizations where slug = 'tellus')
insert into public.metric_definitions (organization_id, code, label, category, target, unit, validation_method, contract_note, sort_order)
select org.id, m.code, m.label, m.category, m.target, m.unit, m.validation_method, m.contract_note, m.sort_order
from org cross join (values
  ('events', 'Eventos calificables', 'Operación', 3::numeric, 'eventos', 'Event Documentation Package', 'Presenciales, 20 asistentes válidos y 20 minutos Stellar.', 10),
  ('content', 'Contenido educativo', 'Operación', 2, 'piezas', 'Enlaces y materiales publicados', 'Contenido original o aprobado, adaptado al territorio.', 20),
  ('scf_referrals', 'Referidos SCF', 'Ecosistema', 2, 'referidos', 'SCF Project Referral Form', 'Presentados por el proceso designado.', 30),
  ('instaward_submissions', 'Candidatos Instaward', 'Ecosistema', 3, 'candidatos', 'Instaward Submissions Form', 'Elegibles y presentados por el proceso designado.', 40),
  ('ambassadors', 'Nuevos embajadores Tier 2+', 'Comunidad', 20, 'personas', 'Airtable / handbook', 'Objetivo KPI; definición mensual pendiente de confirmación.', 50),
  ('developers', 'Desarrolladores activos', 'Builders', 100, 'personas', 'GitHub / Electric Capital', 'Al menos un commit Stellar en una ventana de 28 días.', 60),
  ('scf_awards', 'Proyectos SCF adjudicados', 'Resultado externo', 1, 'proyectos', 'SCF Dashboard', 'KPI fuera del control directo de Tellus.', 70),
  ('instaward_awards', 'Instawards adjudicados', 'Resultado externo', 3, 'premios', 'Instawards Dashboard', 'KPI fuera del control directo de Tellus.', 80)
) as m(code, label, category, target, unit, validation_method, contract_note, sort_order);

insert into public.metric_updates (organization_id, period_id, metric_id)
select p.organization_id, p.id, m.id
from public.reporting_periods p
join public.metric_definitions m on m.organization_id = p.organization_id;

with org as (select id from public.organizations where slug = 'tellus')
insert into public.deliverables (organization_id, period_id, title, description, due_on)
select org.id, null, d.title, d.description, d.due_on
from org cross join (values
  ('Plan de lanzamiento', 'Plan de eventos, embajadores, developers, alianzas y pipelines.', date '2026-07-16'),
  ('Validación KPI — meses 1 a 3', 'Informe trimestral con evidencia para todas las categorías.', date '2026-09-30'),
  ('Validación KPI — meses 4 a 6', 'Informe final de validación con evidencia para todas las categorías.', date '2026-12-31'),
  ('Paquete de transición', 'Roster, cuentas, compromisos, alianzas y recomendaciones de traspaso.', date '2027-01-08')
) as d(title, description, due_on);

insert into public.deliverables (organization_id, period_id, title, description, due_on)
select p.organization_id, p.id, 'Entregables mensuales — ' || lower(p.label),
  'Eventos, contenidos, referidos SCF, candidatos Instaward y reporte mensual con evidencia.', p.report_due_on
from public.reporting_periods p;

with org as (select id from public.organizations where slug = 'tellus')
insert into public.payment_milestones (organization_id, label, amount_usd, status, sort_order)
select org.id, x.label, 2500, 'not_triggered', x.sort_order from org cross join (values
  ('Programa y plan de lanzamiento', 10), ('Desempeño mes 1', 20), ('Desempeño mes 2', 30),
  ('Revisión intermedia mes 3', 40), ('Desempeño meses 4–5', 50), ('Cierre final mes 6', 60)
) as x(label, sort_order);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stellar-evidence', 'stellar-evidence', false, 15728640, array['application/pdf','image/jpeg','image/png','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

create policy storage_evidence_select on storage.objects for select to authenticated
using (bucket_id = 'stellar-evidence' and exists (
  select 1 from public.organization_members m
  where m.user_id = (select auth.uid()) and (storage.foldername(name))[1] = m.organization_id::text
));
create policy storage_evidence_insert on storage.objects for insert to authenticated
with check (bucket_id = 'stellar-evidence' and exists (
  select 1 from public.organization_members m
  where m.user_id = (select auth.uid()) and m.role <> 'viewer' and (storage.foldername(name))[1] = m.organization_id::text
));
create policy storage_evidence_update on storage.objects for update to authenticated
using (bucket_id = 'stellar-evidence' and exists (
  select 1 from public.organization_members m
  where m.user_id = (select auth.uid()) and m.role <> 'viewer' and (storage.foldername(name))[1] = m.organization_id::text
)) with check (bucket_id = 'stellar-evidence' and exists (
  select 1 from public.organization_members m
  where m.user_id = (select auth.uid()) and m.role <> 'viewer' and (storage.foldername(name))[1] = m.organization_id::text
));
