insert into private.admin_allowlist (email, organization_id, role)
select 'kohcuendepau@gmail.com', id, 'admin'::public.member_role
from public.organizations where slug = 'tellus'
on conflict (email) do update set organization_id = excluded.organization_id, role = excluded.role;

insert into public.organization_members (organization_id, user_id, role)
select o.id, u.id, 'admin'::public.member_role
from public.organizations o join auth.users u on lower(u.email) = 'kohcuendepau@gmail.com'
where o.slug = 'tellus'
on conflict (organization_id, user_id) do update set role = 'admin'::public.member_role;

create or replace function public.tierly_is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.organizations o on o.id = m.organization_id
    join auth.users u on u.id = m.user_id
    left join private.admin_allowlist a on lower(a.email) = lower(u.email)
    where m.user_id = (select auth.uid())
      and m.role = 'admin'
      and o.slug = 'tellus'
      and (lower(u.email) = 'kohcuendepau@gmail.com' or lower(u.raw_user_meta_data->>'user_name') = 'kl0ren' or lower(u.raw_user_meta_data->>'preferred_username') = 'kl0ren')
      and (a.role = 'admin' or lower(u.email) = 'kohcuendepau@gmail.com')
  );
$$;
revoke all on function public.tierly_is_admin() from public;
grant execute on function public.tierly_is_admin() to authenticated;
