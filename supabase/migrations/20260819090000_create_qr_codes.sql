-- Ops/Social — banco de códigos QR (link/texto -> QR reusable para bio, flyers, etc).

create table public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text,
  content text not null,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index qr_codes_org_idx on public.qr_codes(organization_id, created_at desc);

create trigger qr_codes_touch before update on public.qr_codes for each row execute function public.touch_updated_at();

alter table public.qr_codes enable row level security;

create policy qr_codes_member_select on public.qr_codes for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = qr_codes.organization_id and m.user_id = (select auth.uid())));
create policy qr_codes_member_all on public.qr_codes for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = qr_codes.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = qr_codes.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));

grant select, insert, update, delete on public.qr_codes to authenticated;
