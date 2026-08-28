-- Estado para que discord-bot pueda anunciar eventos nuevos y subidas de
-- rango una sola vez cada uno, sin reinstalar en memoria (el bot puede
-- reiniciar en cada deploy de Render).

alter table public.gaming_players
  add column if not exists last_notified_rank_min int;

create table public.gaming_bot_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('event')),
  ref_id uuid not null,
  created_at timestamptz not null default now(),
  unique (kind, ref_id)
);
alter table public.gaming_bot_notifications enable row level security;
-- Sin policies a propósito: solo el bot (service_role) lee/escribe acá, igual
-- que gaming_scores.
