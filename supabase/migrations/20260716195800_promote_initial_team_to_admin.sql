update private.admin_allowlist
set role = 'admin'::public.member_role
where lower(email) in (
  'hola@telluscoop.org',
  'kohcuendedani@gmail.com',
  'mishekoh@gmail.com',
  'bastian@telluscoop.org'
);

update public.organization_members m
set role = 'admin'::public.member_role
from auth.users u
where m.user_id = u.id
  and lower(u.email) in (
    'hola@telluscoop.org',
    'kohcuendedani@gmail.com',
    'mishekoh@gmail.com',
    'bastian@telluscoop.org'
  );
