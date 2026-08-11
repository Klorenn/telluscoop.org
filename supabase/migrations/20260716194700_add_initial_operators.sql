insert into private.admin_allowlist (email, organization_id, role)
select invited.email, o.id, 'operator'::public.member_role
from public.organizations o
cross join (
  values
    ('kohcuendedani@gmail.com'),
    ('mishekoh@gmail.com'),
    ('bastian@telluscoop.org')
) as invited(email)
where o.slug = 'tellus'
on conflict (email) do update
set organization_id = excluded.organization_id,
    role = excluded.role;
