-- Tierly P1: recordatorios idempotentes por guild.

create table if not exists public.tierly_event_notifications (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.communities(guild_id) on delete cascade,
  event_id uuid not null references public.gaming_events(id) on delete cascade,
  kind text not null check (kind in ('event_reminder')),
  reminder_minutes integer not null check (reminder_minutes > 0),
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'cancelled')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (guild_id, event_id, kind, reminder_minutes)
);

create index if not exists tierly_event_notifications_due
  on public.tierly_event_notifications (guild_id, scheduled_for)
  where status = 'pending';

alter table public.tierly_event_notifications enable row level security;

create or replace function public.tierly_generate_event_reminders(
  p_reminder_minutes integer default 60,
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
begin
  if p_reminder_minutes <= 0 then
    raise exception 'Los minutos del recordatorio deben ser positivos';
  end if;

  insert into public.tierly_event_notifications
    (guild_id, event_id, kind, reminder_minutes, scheduled_for)
  select
    e.guild_id,
    e.id,
    'event_reminder',
    p_reminder_minutes,
    e.starts_at - make_interval(mins => p_reminder_minutes)
  from public.gaming_events e
  where e.guild_id is not null
    and e.starts_at is not null
    and e.starts_at > p_now
    and e.starts_at - make_interval(mins => p_reminder_minutes) <= p_now
    and e.status in ('scheduled', 'live')
    and exists (
      select 1 from public.communities c
      where c.guild_id = e.guild_id
    )
  on conflict (guild_id, event_id, kind, reminder_minutes) do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

create or replace function public.tierly_cancel_event_reminders()
returns integer
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.tierly_event_notifications n
    set status = 'cancelled'
    from public.gaming_events e
    where e.id = n.event_id
      and n.status = 'pending'
      and e.status in ('cancelled', 'completed')
    returning 1
  )
  select count(*)::integer from updated;
$$;

revoke all on table public.tierly_event_notifications from anon, authenticated;
revoke all on function public.tierly_generate_event_reminders(integer, timestamptz) from public, anon, authenticated;
revoke all on function public.tierly_cancel_event_reminders() from public, anon, authenticated;
grant select, insert, update on public.tierly_event_notifications to service_role;
grant execute on function public.tierly_generate_event_reminders(integer, timestamptz) to service_role;
grant execute on function public.tierly_cancel_event_reminders() to service_role;

select cron.unschedule('tierly-generar-recordatorios')
where exists (select 1 from cron.job where jobname = 'tierly-generar-recordatorios');
select cron.schedule(
  'tierly-generar-recordatorios',
  '*/5 * * * *',
  $$select public.tierly_cancel_event_reminders(); select public.tierly_generate_event_reminders();$$
);
