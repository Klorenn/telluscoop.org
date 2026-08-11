-- Ops/Social — sección de Guías técnicas por blockchain (Stellar, Avalanche,
-- Circle/USDC, Ethereum, Solana, Base, Mantle). Mismo modelo RLS que articles.

create table public.guides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  chain text not null,
  title text not null,
  subtitle text,
  body_md text not null,
  sources jsonb not null default '[]'::jsonb,
  images jsonb not null default '[]'::jsonb,
  social_posts jsonb,
  social_link text,
  model text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'published', 'discarded')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guides_org_idx on public.guides(organization_id, status, created_at desc);

create trigger guides_touch before update on public.guides for each row execute function public.touch_updated_at();

alter table public.guides enable row level security;

create policy guides_member_select on public.guides for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = guides.organization_id and m.user_id = (select auth.uid())));
create policy guides_member_all on public.guides for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = guides.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = guides.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));

grant select on public.guides to authenticated;
grant insert, update, delete on public.guides to authenticated;
