-- Restaura public.gaming_bot_notifications tras la caída de la capa de
-- brackets. La tabla es el registro idempotente que usa discord-bot para no
-- repetir el anuncio de un evento nuevo ni de una subida de rango.
--
-- No es lo mismo que public.tierly_event_notifications: aquella es una cola de
-- entrega de recordatorios (pending -> sent/cancelled) con kind restringido a
-- 'event_reminder'. Esta solo marca "ya anunciado" y no tiene ciclo de entrega.
--
-- La tabla estaba vacía, así que no se pierde historial al recrearla.

create table if not exists public.gaming_bot_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('event')),
  ref_id uuid not null,
  created_at timestamptz not null default now(),
  unique (kind, ref_id)
);

create index if not exists gaming_bot_notifications_created
  on public.gaming_bot_notifications (created_at desc);

alter table public.gaming_bot_notifications enable row level security;

-- Sin policies a propósito: solo el bot (service_role) lee y escribe aquí.
revoke all on table public.gaming_bot_notifications from anon, authenticated;
grant select, insert on public.gaming_bot_notifications to service_role;
