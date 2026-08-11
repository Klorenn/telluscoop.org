alter table public.initiatives
  add column luma_event_id text,
  add column luma_url text,
  add column luma_registered_count integer not null default 0 check (luma_registered_count >= 0),
  add column luma_checked_in_count integer not null default 0 check (luma_checked_in_count >= 0),
  add column luma_synced_at timestamptz;

create unique index initiatives_org_luma_event_unique
  on public.initiatives (organization_id, luma_event_id);
