-- Fase 0: consentimiento explícito y control de presencia de Tierly.
alter table public.observed_members
  add column if not exists consent_status text not null default 'unknown'
    check (consent_status in ('unknown', 'accepted', 'declined')),
  add column if not exists consent_version text,
  add column if not exists consent_accepted_at timestamptz,
  add column if not exists consent_declined_at timestamptz,
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists identity_visible boolean not null default false;

-- Los registros antiguos no se consideran consentimiento afirmativo.
update public.observed_members
set consent_status = case when opted_in then 'accepted' else 'unknown' end,
    consent_accepted_at = case when opted_in and consent_accepted_at is null then now() else consent_accepted_at end
where consent_status = 'unknown' and opted_in;

create index if not exists observed_members_consent
  on public.observed_members (guild_id, consent_status);

create or replace function public.tierly_require_presence_consent()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  enabled boolean;
  status text;
begin
  if tg_op = 'UPDATE' and old.ended_at is null and new.ended_at is not null then
    return new;
  end if;

  select c.presence_enabled into enabled
  from public.communities c where c.guild_id = new.guild_id;
  select m.consent_status into status
  from public.observed_members m
  where m.guild_id = new.guild_id and m.discord_user_id = new.discord_user_id;
  if coalesce(enabled, false) is not true then
    raise exception using errcode = '42501', message = 'La presencia esta deshabilitada para esta comunidad';
  end if;
  if status is distinct from 'accepted' then
    raise exception using errcode = '42501', message = 'El miembro no ha aceptado la observacion de presencia';
  end if;
  return new;
end;
$$;

drop trigger if exists tierly_require_presence_consent on public.play_sessions;
create trigger tierly_require_presence_consent
  before insert or update on public.play_sessions
  for each row execute function public.tierly_require_presence_consent();

create or replace function public.tierly_accept_member_consent(
  target_guild text, target_discord_user_id text, target_version text
)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into public.observed_members (guild_id, discord_user_id, consent_status, consent_version,
    consent_accepted_at, consent_declined_at, deletion_requested_at, opted_in)
  values (target_guild, target_discord_user_id, 'accepted', target_version, now(), null, null, true)
  on conflict (guild_id, discord_user_id) do update set
    consent_status = 'accepted', consent_version = excluded.consent_version,
    consent_accepted_at = now(), consent_declined_at = null, deletion_requested_at = null, opted_in = true;
  return true;
end; $$;

create or replace function public.tierly_decline_member_consent(
  target_guild text, target_discord_user_id text
)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.play_sessions set ended_at = now(), closed_reason = 'normal'
  where guild_id = target_guild and discord_user_id = target_discord_user_id and ended_at is null;
  delete from public.play_sessions where guild_id = target_guild and discord_user_id = target_discord_user_id;
  update public.observed_members set consent_status = 'declined', consent_declined_at = now(),
    consent_accepted_at = null, identity_visible = false, opted_in = false
  where guild_id = target_guild and discord_user_id = target_discord_user_id;
  return true;
end; $$;

create or replace function public.tierly_request_member_deletion(
  target_guild text, target_discord_user_id text
)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.play_sessions set ended_at = now(), closed_reason = 'normal'
  where guild_id = target_guild and discord_user_id = target_discord_user_id and ended_at is null;
  delete from public.play_sessions where guild_id = target_guild and discord_user_id = target_discord_user_id;
  update public.observed_members set deletion_requested_at = now(), consent_status = 'declined',
    consent_declined_at = now(), consent_accepted_at = null, identity_visible = false, opted_in = false
  where guild_id = target_guild and discord_user_id = target_discord_user_id;
  return true;
end; $$;

revoke all on function public.tierly_accept_member_consent(text, text, text),
  public.tierly_decline_member_consent(text, text),
  public.tierly_request_member_deletion(text, text) from public, anon, authenticated;
grant execute on function public.tierly_accept_member_consent(text, text, text),
  public.tierly_decline_member_consent(text, text),
  public.tierly_request_member_deletion(text, text) to service_role;
