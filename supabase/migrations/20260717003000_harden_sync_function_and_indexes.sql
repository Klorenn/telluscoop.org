-- Trigger-only function: it must not be callable through the public RPC API.
revoke execute on function public.sync_event_attendance_to_participant() from public, anon, authenticated;

-- Cover foreign keys used by the operational dashboard and audit trail.
create index if not exists admin_allowlist_organization_idx
  on private.admin_allowlist (organization_id);
create index if not exists audit_log_actor_user_idx
  on public.audit_log (actor_user_id);
create index if not exists program_budgets_organization_period_idx
  on public.program_budgets (organization_id, period_id);
create index if not exists program_participants_organization_idx
  on public.program_participants (organization_id);
create index if not exists program_resources_organization_idx
  on public.program_resources (organization_id);
create index if not exists programs_lead_user_idx
  on public.programs (lead_user_id)
  where lead_user_id is not null;
