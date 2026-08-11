-- Ops/Social — meta de crecimiento neto mensual + refresh diario automático de X.
--
-- El refresh automático solo existe para X (único canal con scraper). LinkedIn
-- e Instagram no tienen API/scraper aprobado todavía y siguen siendo manuales
-- (ver ops/social/README.md, Fase 5).
--
-- Requisito único, manual, NO versionado acá (son secretos): correr una vez en
-- el SQL editor de Supabase antes de aplicar esta migración —
--   select vault.create_secret('https://rhzanxzoqmbxptvxgnfj.supabase.co', 'project_url');
--   select vault.create_secret('<service-role key del proyecto>', 'service_role_key');

alter table public.social_goals add column if not exists target_monthly_growth numeric check (target_monthly_growth >= 0);

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'daily-x-profile-refresh',
  '0 9 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/x-profile',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := jsonb_build_object('handle', 'telluscoop')
  );
  $$
);
