alter table public.program_participants
  add column if not exists events_attended text,
  add column if not exists discord text,
  add column if not exists roster_source text,
  add column if not exists program_status text,
  add column if not exists program_role text,
  add column if not exists discord_roles text,
  add column if not exists participant_type text,
  add column if not exists city text,
  add column if not exists country text,
  add column if not exists personal_url text,
  add column if not exists project_company text,
  add column if not exists experience text,
  add column if not exists classification_note text,
  add column if not exists phone text,
  add column if not exists source_data jsonb not null default '{}'::jsonb;

comment on column public.program_participants.source_data is
  'Original imported row retained losslessly for traceability and future mappings.';
