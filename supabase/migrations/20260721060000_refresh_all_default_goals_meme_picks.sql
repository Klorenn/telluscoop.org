-- Ops/Social — el cron diario refresca las 3 cuentas, metas default de
-- crecimiento (+200/mes) y banco de memes guardados (meme_picks).

-- 1. Reprogramar el cron para refrescar X + Instagram + LinkedIn.
select cron.unschedule('daily-x-profile-refresh')
where exists (select 1 from cron.job where jobname = 'daily-x-profile-refresh');

select cron.schedule(
  'daily-x-profile-refresh',
  '0 9 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/x-profile',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := jsonb_build_object('handle', 'telluscoop', 'refresh', 'all')
  );
  $$
);

-- 2. Meta default: +200 seguidores al mes por cuenta (editable desde la UI).
with org as (select id from public.organizations where slug = 'tellus')
insert into public.social_goals (organization_id, platform, target_monthly_growth)
select org.id, p.platform, 200
from org cross join (values ('x'), ('linkedin'), ('instagram')) as p(platform)
on conflict (organization_id, platform) do update
  set target_monthly_growth = coalesce(public.social_goals.target_monthly_growth, excluded.target_monthly_growth);

-- 3. Banco de memes: los que scrapeamos/elegimos para reusar.
create table public.meme_picks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text,
  image_url text not null,
  page_url text,
  source text not null default 'reddit',
  subreddit text,
  score numeric not null default 0 check (score >= 0),
  status text not null default 'inbox' check (status in ('inbox', 'used', 'discarded')),
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, image_url)
);
create index meme_picks_org_idx on public.meme_picks(organization_id, status, created_at desc);

create trigger meme_picks_touch before update on public.meme_picks for each row execute function public.touch_updated_at();

alter table public.meme_picks enable row level security;

create policy meme_picks_member_select on public.meme_picks for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = meme_picks.organization_id and m.user_id = (select auth.uid())));
create policy meme_picks_member_all on public.meme_picks for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = meme_picks.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = meme_picks.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));

grant select, insert, update, delete on public.meme_picks to authenticated;
