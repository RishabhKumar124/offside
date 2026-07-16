-- Runs the push dispatcher Edge Function once per minute.
-- Replace the Authorization value if you rotate the anon key.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

select cron.unschedule('dispatch-push-notifications-every-minute')
where exists (
  select 1
  from cron.job
  where jobname = 'dispatch-push-notifications-every-minute'
);

select cron.schedule(
  'dispatch-push-notifications-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://ayhlzpfooxukxsfbvsov.supabase.co/functions/v1/dispatch-push-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer REPLACE_WITH_SUPABASE_ANON_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);
