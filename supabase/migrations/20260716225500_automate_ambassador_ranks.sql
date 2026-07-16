alter table public.program_participants
  add column if not exists events_attended_count integer not null default 0 check (events_attended_count >= 0),
  add column if not exists rank_mode text not null default 'automatic' check (rank_mode in ('automatic','manual')),
  add column if not exists rank_updated_at timestamptz,
  add column if not exists rank_updated_by uuid references auth.users(id) on delete set null;

update public.program_participants
set events_attended_count = case
      when coalesce(events_attended, '') ~ '^\s*[0-9]+\s*$' then trim(events_attended)::integer
      else 0
    end,
    rank_mode = case when lower(coalesce(participant_rank,'')) in ('leader','contributor') then 'manual' else 'automatic' end;

create or replace function public.apply_ambassador_rank()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.events_attended_count := greatest(coalesce(new.events_attended_count, 0), 0);
  new.events_attended := new.events_attended_count::text;

  if new.rank_mode = 'automatic' then
    new.participant_rank := case
      when new.events_attended_count >= 3 then 'Builder'
      when new.events_attended_count >= 2 and nullif(trim(coalesce(new.github,'')), '') is not null then 'Builder'
      else 'Explorer'
    end;
    if new.participant_rank is distinct from old.participant_rank then
      new.rank_updated_at := now();
      new.rank_updated_by := (select auth.uid());
    end if;
  elsif new.participant_rank not in ('Contributor','Leader') then
    raise exception 'Los rangos manuales permitidos son Contributor y Leader';
  end if;

  return new;
end;
$$;

drop trigger if exists apply_ambassador_rank_trigger on public.program_participants;
create trigger apply_ambassador_rank_trigger
before insert or update of events_attended_count, github, rank_mode, participant_rank
on public.program_participants
for each row execute function public.apply_ambassador_rank();

-- Run every automatic profile through the rule after the trigger exists.
update public.program_participants
set events_attended_count = events_attended_count
where rank_mode = 'automatic';

create or replace function public.sync_event_attendance_to_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_attended boolean := false;
  new_attended boolean := false;
  target_email text;
  target_initiative uuid;
  target_program uuid;
  delta integer;
begin
  if tg_op <> 'INSERT' then old_attended := old.attendance_status = 'attended'; end if;
  if tg_op <> 'DELETE' then new_attended := new.attendance_status = 'attended'; end if;
  delta := (case when new_attended then 1 else 0 end) - (case when old_attended then 1 else 0 end);
  if delta = 0 then return coalesce(new, old); end if;

  target_email := lower(trim(coalesce(new.email, old.email)));
  target_initiative := coalesce(new.initiative_id, old.initiative_id);
  select i.program_id into target_program from public.initiatives i where i.id = target_initiative;

  update public.program_participants p
  set events_attended_count = greatest(p.events_attended_count + delta, 0), updated_at = now()
  where p.program_id = target_program and p.email = target_email;

  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_event_attendance_to_participant_trigger on public.event_contacts;
create trigger sync_event_attendance_to_participant_trigger
after insert or update of attendance_status or delete on public.event_contacts
for each row execute function public.sync_event_attendance_to_participant();

comment on column public.program_participants.rank_mode is
  'automatic promotes Explorer to Builder; manual is reserved for Contributor and Leader.';
