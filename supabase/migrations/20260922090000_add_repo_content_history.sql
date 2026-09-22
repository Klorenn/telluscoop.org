-- Historial editorial persistente para el descubrimiento de repositorios.
alter table public.repo_picks
  add column if not exists social_posts jsonb,
  add column if not exists social_sources jsonb not null default '[]'::jsonb,
  add column if not exists social_model text,
  add column if not exists generated_at timestamptz;

create index if not exists repo_picks_generated_at_idx
  on public.repo_picks(organization_id, generated_at desc);
