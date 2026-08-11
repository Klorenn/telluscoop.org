with names(email, full_name) as (values
  ('alexbnjmnch@gmail.com','Alex Hernández'),
  ('inboxblessedux@gmail.com','Joaquín Farfán')
)
update auth.users u set raw_user_meta_data = coalesce(u.raw_user_meta_data,'{}'::jsonb) || jsonb_build_object('full_name', names.full_name)
from names where lower(u.email) = names.email;

with names(email, full_name) as (values
  ('alexbnjmnch@gmail.com','Alex Hernández'),
  ('inboxblessedux@gmail.com','Joaquín Farfán')
)
insert into public.profiles (id, full_name)
select u.id, names.full_name from auth.users u join names on lower(u.email) = names.email
on conflict (id) do update set full_name = excluded.full_name;
