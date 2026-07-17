-- Render free instances sleep after 15 min idle; the cold start then blows the
-- edge function budget and the feed errors. Ping /health every 10 minutes.
-- Render free tier grants 750 instance-hours/month, so 24/7 fits.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'keep-x-search-awake',
  '*/10 * * * *',
  $$ select net.http_get('https://telluscoop-x-search.onrender.com/health') $$
);
