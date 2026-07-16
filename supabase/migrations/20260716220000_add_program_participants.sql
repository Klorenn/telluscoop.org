create table public.program_participants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  full_name text,
  email text not null check (email = lower(trim(email))),
  github text,
  participant_rank text,
  source_name text,
  imported_by uuid references auth.users(id) on delete set null,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, email)
);
create index program_participants_program_idx on public.program_participants(program_id, full_name);

alter table public.program_participants enable row level security;
create policy program_participants_member_select on public.program_participants for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = program_participants.organization_id and m.user_id = (select auth.uid())));
create policy program_participants_editor_all on public.program_participants for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = program_participants.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = program_participants.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));

grant select, insert, update, delete on public.program_participants to authenticated;
