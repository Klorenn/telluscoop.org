-- Actualización administrativa de sugerencias, limitada a la comunidad autorizada.
create or replace function public.tierly_update_suggestion_status(
  p_suggestion_id bigint,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('accepted', 'dismissed') then
    raise exception 'Estado de sugerencia no permitido';
  end if;

  update public.suggested_events suggestion
  set status = p_status
  where suggestion.id = p_suggestion_id
    and exists (
      select 1
      from public.community_admins administrator
      where administrator.guild_id = suggestion.guild_id
        and administrator.user_id = (select auth.uid())
    );

  return found;
end;
$$;

revoke all on function public.tierly_update_suggestion_status(bigint, text) from public, anon;
grant execute on function public.tierly_update_suggestion_status(bigint, text) to authenticated;
