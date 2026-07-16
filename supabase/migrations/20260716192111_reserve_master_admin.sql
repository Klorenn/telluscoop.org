create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.admin_allowlist (
  email text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role public.member_role not null default 'admin',
  created_at timestamptz not null default now()
);
revoke all on private.admin_allowlist from public, anon, authenticated;

insert into private.admin_allowlist (email, organization_id, role)
select lower('hola@telluscoop.org'), id, 'admin'
from public.organizations
where slug = 'tellus';

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.organization_members (organization_id, user_id, role)
  select a.organization_id, new.id, a.role
  from private.admin_allowlist a
  where lower(a.email) = lower(new.email)
  on conflict (organization_id, user_id) do update set role = excluded.role;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();
