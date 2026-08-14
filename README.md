# Offside

Offside is a mobile-first pickup soccer app for organizing games, collecting RSVPs, balancing teams, tracking match stats, voting for player awards, and building lightweight player rankings.

[Live app](https://offside-beta.vercel.app)

## Product highlights

| Capability | What it enables |
| --- | --- |
| **Game coordination** | Create pickup games, invite players, and keep RSVP state visible before match day. |
| **Team building** | Turn attendance into playable squads without juggling messages and spreadsheets. |
| **Post-game stats** | Capture goals, assists, attendance, rankings, and Man of the Match votes after a game. |
| **Mobile app path** | Capacitor support keeps the product aligned with the phone-first way pickup games actually happen. |
| **Backend foundation** | Supabase schema, auth, storage, and scheduled functions support the live workflow. |

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill in your Supabase values in `.env.local`:

```text
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_PROFILE_PHOTO_BUCKET=profile-photos
```

Apply the database schema from `backend/schema.sql` in the Supabase SQL Editor.

## Useful scripts

```bash
npm run build
npm run lint
npm run cap:sync
npm run android:open
npm run android:bundle
```

## Android / Google Play path

The app uses Capacitor with package id `com.rishabhkumar.offside`.

1. Build and sync the web app with `npm run cap:sync`.
2. Open Android Studio with `npm run android:open`.
3. Configure release signing.
4. Build a signed Android App Bundle for Play Console.

## Why this is in my portfolio

Offside shows product thinking around a real-world coordination loop: pre-game planning, live participation, post-game stats, and repeat engagement for a small sports community.
