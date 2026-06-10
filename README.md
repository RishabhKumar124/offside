# Offside

Offside is a mobile-first pickup football app for creating games, joining RSVPs, building teams, tracking post-game stats, voting for Man of the Match, and viewing player rankings.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file:

```bash
cp .env.example .env.local
```

3. Fill in your Supabase values:

```text
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_PROFILE_PHOTO_BUCKET=profile-photos
```

4. Apply the database schema in Supabase SQL Editor using `backend/schema.sql`.

5. Run the web app:

```bash
npm run dev
```

## Supabase setup

- Run `backend/schema.sql` in the Supabase SQL Editor.
- In Authentication > Providers, enable Email and Google if you want Google sign-in.
- Add your app URLs to Authentication > URL Configuration. For local testing, include `http://localhost:5173`.
- The profile photo bucket is created by the schema as `profile-photos`.
- To make a user an admin, update their profile row:

```sql
update public.users set role = 'admin' where email = 'you@example.com';
```

## Scheduled game reminders

The scheduled reminder is implemented at `supabase/functions/game-reminder/index.ts`.

Deploy it with:

```bash
supabase functions deploy game-reminder
```

Then schedule it every five minutes from Supabase Cron. See `supabase/functions/game-reminder/README.md` for SQL and dashboard notes.

## Web build

```bash
npm run build
npm run preview
```

## Android / Google Play build

This app uses Capacitor with package id `com.rishabhkumar.offside`.

1. Install Android Studio, a JDK, and the Android SDK.
2. Build and sync the web app into Android:

```bash
npm run cap:sync
```

3. Open the Android project:

```bash
npm run android:open
```

4. In Android Studio, configure a release signing key.
5. Build a signed Android App Bundle (`.aab`) for Play Console.

Google Play release checklist:

- Create the app in Play Console.
- Confirm app name: Offside.
- Confirm package id: `com.rishabhkumar.offside`.
- Upload a signed `.aab`.
- Complete Play app signing setup.
- Add a privacy policy URL.
- Complete Data safety and Content rating forms.
- Add app category, short description, full description, screenshots, icon, and feature graphic.
- Use internal or closed testing before production rollout if your developer account requires it.

## Useful scripts

```bash
npm run dev
npm run build
npm run lint
npm run cap:sync
npm run android:open
npm run android:bundle
```
