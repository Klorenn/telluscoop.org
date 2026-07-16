-- Remove inherited Storage access from the retired application.
drop policy if exists "Anyone can view avatars" on storage.objects;
drop policy if exists "Authenticated users can read avatars" on storage.objects;
drop policy if exists "Authenticated users can upload avatars" on storage.objects;
drop policy if exists "Doctors can upload prescriptions" on storage.objects;
drop policy if exists "Patients can view own prescriptions" on storage.objects;
drop policy if exists "Users can delete own avatars" on storage.objects;
drop policy if exists "Users can update own avatars" on storage.objects;
drop policy if exists "Users can upload own avatars" on storage.objects;
drop policy if exists "message_files_select" on storage.objects;
drop policy if exists "message_files_upload" on storage.objects;
drop policy if exists "professional_delete_consultation_photos" on storage.objects;
drop policy if exists "professional_read_consultation_photos" on storage.objects;
drop policy if exists "professional_upload_consultation_photos" on storage.objects;
drop policy if exists "professionals_upload_credentials" on storage.objects;
drop policy if exists "professionals_view_own_credential_files" on storage.objects;
update storage.buckets set public = false where id <> 'stellar-evidence';

-- Split write policies from SELECT so each request evaluates one permissive policy.
drop policy if exists periods_member_all on public.reporting_periods;
create policy periods_member_insert on public.reporting_periods for insert to authenticated
with check (exists (select 1 from public.organization_members m where m.organization_id = reporting_periods.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));
create policy periods_member_update on public.reporting_periods for update to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = reporting_periods.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = reporting_periods.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));
create policy periods_member_delete on public.reporting_periods for delete to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = reporting_periods.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));

drop policy if exists metric_updates_member_all on public.metric_updates;
create policy metric_updates_member_insert on public.metric_updates for insert to authenticated
with check (exists (select 1 from public.organization_members m where m.organization_id = metric_updates.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));
create policy metric_updates_member_update on public.metric_updates for update to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = metric_updates.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = metric_updates.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));
create policy metric_updates_member_delete on public.metric_updates for delete to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = metric_updates.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));

drop policy if exists initiatives_member_all on public.initiatives;
create policy initiatives_member_insert on public.initiatives for insert to authenticated
with check (exists (select 1 from public.organization_members m where m.organization_id = initiatives.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));
create policy initiatives_member_update on public.initiatives for update to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = initiatives.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = initiatives.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));
create policy initiatives_member_delete on public.initiatives for delete to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = initiatives.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));

drop policy if exists deliverables_member_all on public.deliverables;
create policy deliverables_member_insert on public.deliverables for insert to authenticated
with check (exists (select 1 from public.organization_members m where m.organization_id = deliverables.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));
create policy deliverables_member_update on public.deliverables for update to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = deliverables.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = deliverables.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));
create policy deliverables_member_delete on public.deliverables for delete to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = deliverables.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));

drop policy if exists evidence_member_all on public.evidence;
create policy evidence_member_insert on public.evidence for insert to authenticated
with check (exists (select 1 from public.organization_members m where m.organization_id = evidence.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));
create policy evidence_member_update on public.evidence for update to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = evidence.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'))
with check (exists (select 1 from public.organization_members m where m.organization_id = evidence.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));
create policy evidence_member_delete on public.evidence for delete to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = evidence.organization_id and m.user_id = (select auth.uid()) and m.role <> 'viewer'));

drop policy if exists payments_finance_all on public.payment_milestones;
create policy payments_finance_insert on public.payment_milestones for insert to authenticated
with check (exists (select 1 from public.organization_members m where m.organization_id = payment_milestones.organization_id and m.user_id = (select auth.uid()) and m.role in ('admin', 'finance')));
create policy payments_finance_update on public.payment_milestones for update to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = payment_milestones.organization_id and m.user_id = (select auth.uid()) and m.role in ('admin', 'finance')))
with check (exists (select 1 from public.organization_members m where m.organization_id = payment_milestones.organization_id and m.user_id = (select auth.uid()) and m.role in ('admin', 'finance')));
create policy payments_finance_delete on public.payment_milestones for delete to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = payment_milestones.organization_id and m.user_id = (select auth.uid()) and m.role in ('admin', 'finance')));

drop policy if exists funds_finance_all on public.fund_transactions;
create policy funds_finance_insert on public.fund_transactions for insert to authenticated
with check (exists (select 1 from public.organization_members m where m.organization_id = fund_transactions.organization_id and m.user_id = (select auth.uid()) and m.role in ('admin', 'finance')));
create policy funds_finance_update on public.fund_transactions for update to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = fund_transactions.organization_id and m.user_id = (select auth.uid()) and m.role in ('admin', 'finance')))
with check (exists (select 1 from public.organization_members m where m.organization_id = fund_transactions.organization_id and m.user_id = (select auth.uid()) and m.role in ('admin', 'finance')));
create policy funds_finance_delete on public.fund_transactions for delete to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = fund_transactions.organization_id and m.user_id = (select auth.uid()) and m.role in ('admin', 'finance')));

create index deliverables_owner_idx on public.deliverables(owner_id);
create index deliverables_period_idx on public.deliverables(period_id);
create index evidence_deliverable_idx on public.evidence(deliverable_id);
create index evidence_initiative_idx on public.evidence(initiative_id);
create index evidence_uploaded_by_idx on public.evidence(uploaded_by);
create index fund_transactions_created_by_idx on public.fund_transactions(created_by);
create index initiatives_created_by_idx on public.initiatives(created_by);
create index initiatives_owner_idx on public.initiatives(owner_id);
create index initiatives_period_idx on public.initiatives(period_id);
create index metric_updates_metric_idx on public.metric_updates(metric_id);
create index metric_updates_owner_idx on public.metric_updates(owner_id);
create index metric_updates_updated_by_idx on public.metric_updates(updated_by);
