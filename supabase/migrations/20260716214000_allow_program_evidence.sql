alter table public.evidence drop constraint evidence_check;
alter table public.evidence add constraint evidence_parent_check
  check (program_id is not null or initiative_id is not null or deliverable_id is not null);
