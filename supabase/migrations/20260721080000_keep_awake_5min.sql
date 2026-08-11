-- Render free sleeps after ~15 min idle. Pinging every 10 min left windows
-- where a missed ping (job hiccup) let it sleep. Ping every 5 min instead —
-- 750 instance-hours/month still covers 24/7 since the ping just keeps the
-- existing instance warm, it doesn't spawn new ones.
select cron.unschedule('keep-x-search-awake')
where exists (select 1 from cron.job where jobname = 'keep-x-search-awake');

select cron.schedule(
  'keep-x-search-awake',
  '*/5 * * * *',
  $$ select net.http_get('https://telluscoop-x-search.onrender.com/health') $$
);
