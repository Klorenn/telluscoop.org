-- Permite que cada usuario gestione únicamente su propio consentimiento.
create or replace function public.tierly_member_owns_discord_id(target_discord_user_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gaming_players
    where auth_user_id = (select auth.uid())
      and discord_id = target_discord_user_id
  );
$$;

create or replace function public.tierly_accept_member_consent(target_guild text, target_discord_user_id text, target_version text)
returns boolean language plpgsql security definer set search_path = public as $$
  if (select auth.uid()) is not null and not public.tierly_member_owns_discord_id(target_discord_user_id) then
    raise exception 'Solo se puede modificar el consentimiento propio';
  end if;
  insert into public.observed_members (guild_id, discord_user_id, consent_status, consent_version, consent_accepted_at, consent_declined_at, deletion_requested_at, opted_in)
  values (target_guild, target_discord_user_id, 'accepted', target_version, now(), null, null, true)
  on conflict (guild_id, discord_user_id) do update set consent_status = 'accepted', consent_version = excluded.consent_version, consent_accepted_at = now(), consent_declined_at = null, deletion_requested_at = null, opted_in = true;
  return true;
end; $$;

create or replace function public.tierly_decline_member_consent(target_guild text, target_discord_user_id text)
returns boolean language plpgsql security definer set search_path = public as $$
  if (select auth.uid()) is not null and not public.tierly_member_owns_discord_id(target_discord_user_id) then
    raise exception 'Solo se puede modificar el consentimiento propio';
  end if;
  delete from public.play_sessions where guild_id = target_guild and discord_user_id = target_discord_user_id;
  update public.observed_members set consent_status = 'declined', consent_declined_at = now(), consent_accepted_at = null, identity_visible = false, opted_in = false where guild_id = target_guild and discord_user_id = target_discord_user_id;
  return true;
end; $$;

create or replace function public.tierly_request_member_deletion(target_guild text, target_discord_user_id text)
returns boolean language plpgsql security definer set search_path = public as $$
  if (select auth.uid()) is not null and not public.tierly_member_owns_discord_id(target_discord_user_id) then
    raise exception 'Solo se puede modificar el consentimiento propio';
  end if;
  delete from public.play_sessions where guild_id = target_guild and discord_user_id = target_discord_user_id;
  update public.observed_members set deletion_requested_at = now(), consent_status = 'declined', consent_declined_at = now(), consent_accepted_at = null, identity_visible = false, opted_in = false where guild_id = target_guild and discord_user_id = target_discord_user_id;
  return true;
end; $$;

grant execute on function public.tierly_member_owns_discord_id(text) to authenticated;
grant execute on function public.tierly_accept_member_consent(text, text, text) to authenticated;
grant execute on function public.tierly_decline_member_consent(text, text) to authenticated;
grant execute on function public.tierly_request_member_deletion(text, text) to authenticated;
