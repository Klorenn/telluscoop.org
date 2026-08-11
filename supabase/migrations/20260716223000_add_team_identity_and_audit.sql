insert into private.admin_allowlist (email, organization_id, role)
select 'alexbnjmnch@gmail.com', id, 'admin'::public.member_role
from public.organizations where slug = 'tellus'
on conflict (email) do update set organization_id = excluded.organization_id, role = excluded.role;

with names(email, full_name) as (values
  ('kohcuendepau@gmail.com','Pau Koh'),
  ('hola@telluscoop.org','Tellus Cooperative Admin'),
  ('bastian@telluscoop.org','Bastian'),
  ('mishekoh@gmail.com','Mishelle'),
  ('kohcuendedani@gmail.com','Daniel'),
  ('alexbnjmnch@gmail.com','Alex Hernández'),
  ('inboxblessedux@gmail.com','Joaquín Farfán')
)
update auth.users u set raw_user_meta_data = coalesce(u.raw_user_meta_data,'{}'::jsonb) || jsonb_build_object('full_name', names.full_name)
from names where lower(u.email) = names.email;

with names(email, full_name) as (values
  ('kohcuendepau@gmail.com','Pau Koh'),
  ('hola@telluscoop.org','Tellus Cooperative Admin'),
  ('bastian@telluscoop.org','Bastian'),
  ('mishekoh@gmail.com','Mishelle'),
  ('kohcuendedani@gmail.com','Daniel'),
  ('alexbnjmnch@gmail.com','Alex Hernández'),
  ('inboxblessedux@gmail.com','Joaquín Farfán')
)
insert into public.profiles (id, full_name)
select u.id, names.full_name from auth.users u join names on lower(u.email) = names.email
on conflict (id) do update set full_name = excluded.full_name;

alter table public.programs add column lead_email text;
alter table public.programs add column lead_user_id uuid references auth.users(id) on delete set null;
update public.programs set lead_email = case code when 'stellar_academy' then 'alexbnjmnch@gmail.com' when 'stellar_barrio' then 'inboxblessedux@gmail.com' else lead_email end;
update public.programs p set lead_user_id = u.id from auth.users u where lower(u.email) = lower(p.lead_email);

create or replace function private.link_program_lead()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.programs set lead_user_id = new.id where lower(lead_email) = lower(new.email);
  return new;
end;
$$;
revoke all on function private.link_program_lead() from public, anon, authenticated;
create trigger link_program_lead_after_signup after insert on auth.users for each row execute function private.link_program_lead();

create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid references public.programs(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('insert','update','delete')),
  entity_table text not null,
  entity_id text,
  entity_label text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_org_created_idx on public.audit_log(organization_id, created_at desc);
create index audit_log_program_created_idx on public.audit_log(program_id, created_at desc);
alter table public.audit_log enable row level security;
create policy audit_log_member_select on public.audit_log for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = audit_log.organization_id and m.user_id = (select auth.uid())));
grant select on public.audit_log to authenticated;

create or replace function public.capture_ops_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  row_data jsonb;
  old_row jsonb;
  org uuid;
  program uuid;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  old_row := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  org := nullif(row_data ->> 'organization_id','')::uuid;
  program := nullif(row_data ->> 'program_id','')::uuid;
  if program is null and tg_table_name = 'metric_updates' then select program_id into program from public.metric_definitions where id = nullif(row_data ->> 'metric_id','')::uuid; end if;
  if program is null and tg_table_name = 'event_contacts' then select program_id into program from public.initiatives where id = nullif(row_data ->> 'initiative_id','')::uuid; end if;
  insert into public.audit_log (organization_id, program_id, actor_user_id, action, entity_table, entity_id, entity_label, old_data, new_data)
  values (org, program, (select auth.uid()), lower(tg_op), tg_table_name, row_data ->> 'id', coalesce(row_data ->> 'title', row_data ->> 'label', row_data ->> 'description', row_data ->> 'email', row_data ->> 'full_name'), old_row, case when tg_op = 'DELETE' then null else row_data end);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function public.capture_ops_audit() from public, anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['programs','program_budgets','program_resources','program_participants','initiatives','deliverables','evidence','fund_transactions','metric_definitions','metric_updates','event_contacts']
  loop
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.capture_ops_audit()', table_name, table_name);
  end loop;
end $$;
