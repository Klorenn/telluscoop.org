alter table public.programs
  add column if not exists lead_emails text[] not null default '{}'::text[];

update public.programs
set lead_email = case code
      when 'stellar_chile' then 'bastian@telluscoop.org'
      when 'stellar_barrio' then 'inboxblessedux@gmail.com'
      when 'stellar_academy' then 'alexbnjmnch@gmail.com'
      when 'coffee_breaks' then 'kohcuendedani@gmail.com'
      else lead_email
    end,
    lead_emails = case code
      when 'stellar_chile' then array['bastian@telluscoop.org']
      when 'stellar_barrio' then array['inboxblessedux@gmail.com']
      when 'stellar_academy' then array['alexbnjmnch@gmail.com']
      when 'coffee_breaks' then array['kohcuendedani@gmail.com','mishekoh@gmail.com']
      else lead_emails
    end
where code in ('stellar_chile','stellar_barrio','stellar_academy','coffee_breaks');

update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name','Bastian Koh')
where lower(email) = 'bastian@telluscoop.org';

update public.profiles p
set full_name = 'Bastian Koh', updated_at = now()
from auth.users u
where p.id = u.id and lower(u.email) = 'bastian@telluscoop.org';

comment on column public.programs.lead_emails is
  'Ordered list of program leads; lead_email remains the primary lead for compatibility.';
