insert into private.admin_allowlist (email, organization_id, role)
select 'inboxblessedux@gmail.com', id, 'admin'::public.member_role
from public.organizations
where slug = 'tellus'
on conflict (email) do update
set organization_id = excluded.organization_id,
    role = excluded.role;

insert into public.profiles (id, full_name)
select id, coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1))
from auth.users
where lower(email) = 'inboxblessedux@gmail.com'
on conflict (id) do nothing;

insert into public.organization_members (organization_id, user_id, role)
select o.id, u.id, 'admin'::public.member_role
from public.organizations o
join auth.users u on lower(u.email) = 'inboxblessedux@gmail.com'
where o.slug = 'tellus'
on conflict (organization_id, user_id) do update set role = excluded.role;
