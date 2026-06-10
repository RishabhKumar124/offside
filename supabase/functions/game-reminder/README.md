# Game reminder function

Deploy this function after linking the project with the Supabase CLI:

```bash
supabase functions deploy game-reminder
```

Schedule it from Supabase Dashboard > Integrations > Cron, or with SQL using pg_cron and pg_net. A five-minute schedule works with the function's ten-minute reminder window:

```sql
select cron.schedule(
  'game-reminder-every-five-minutes',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/game-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SUPABASE_ANON_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

The function uses `SUPABASE_SERVICE_ROLE_KEY` from Edge Function secrets to write reminder notifications.
