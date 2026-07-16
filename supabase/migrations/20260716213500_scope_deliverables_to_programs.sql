alter table public.deliverables add column program_id uuid references public.programs(id) on delete set null;
create index deliverables_program_idx on public.deliverables(program_id, due_on);
update public.deliverables d set program_id = p.id
from public.programs p where p.organization_id = d.organization_id and p.code = 'stellar_chile' and d.program_id is null;
