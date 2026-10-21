-- Run this AFTER the app is live on Vercel. It calls the app every 5 minutes
-- to send meal reminders and mark doses not taken.
-- Replace both placeholders before running. Do not commit the real secret.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'carenest-tick',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://carenest.vercel.app/api/cron/tick',
    headers := jsonb_build_object('Authorization', 'Bearer REPLACE_WITH_CRON_SECRET')
  );
  $$
);
