# Dispatch push notifications

This function sends queued Offside notification rows to Android devices through Firebase Cloud Messaging.

## Required SQL

Run this in the Offside Supabase SQL Editor first:

```sql
-- backend/push_notifications.sql
```

That creates:

- `public.push_tokens`
- `public.push_delivery_queue`
- `register_push_token(...)`
- `deactivate_push_token(...)`
- a trigger that queues every inserted `public.notifications` row for push delivery

## Firebase setup

1. Create or open a Firebase project.
2. Add an Android app with package name:

```text
com.rishabhkumar.offside
```

3. Download `google-services.json`.
4. Put it here:

```text
android/app/google-services.json
```

5. In Firebase, create a service account private key:

```text
Project settings -> Service accounts -> Generate new private key
```

## Supabase Edge Function secrets

Set these secrets in Supabase:

```bash
supabase secrets set FIREBASE_PROJECT_ID="your-firebase-project-id"
supabase secrets set FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
supabase secrets set FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available to Supabase Edge Functions.

## Deploy

```bash
supabase functions deploy dispatch-push-notifications
```

## Schedule

Run every minute from Supabase Cron. Replace project ref and anon key:

```sql
select cron.schedule(
  'dispatch-push-notifications-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/dispatch-push-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SUPABASE_ANON_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Once this is running, new rows in `public.notifications` become Android push notifications for users who have opened the native Android app and granted notification permission.
