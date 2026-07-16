-- Run only after the first administrator has created an Auth account.
-- Replace the email before executing this statement in Supabase SQL Editor.
insert into public.organization_members (organization_id, user_id, role)
select o.id, u.id, 'admin'::public.member_role
from public.organizations o
join auth.users u on lower(u.email) = lower('ADMIN_EMAIL_HERE')
where o.slug = 'tellus'
on conflict (organization_id, user_id) do update set role = excluded.role;
