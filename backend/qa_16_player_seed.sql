-- Resets disposable QA data and creates exactly one 16-player lifecycle game.
--
-- Creates:
-- - 1 real host account
-- - 1 real normal-player account
-- - 14 fake bot players
-- - OFFSIDE QA - 16 Player Lifecycle
--
-- Use this game to test the real flow:
-- host announces teams -> normal player receives notification
-- host ends match -> players receive stats notification
-- normal player submits stats and votes MVP
-- host approves stats
-- MVP auto-announces when all confirmed players vote, or after the 2-hour
-- voting window once someone opens the game.
--
-- The 14 fake bot players are pre-seeded with MVP votes. That leaves only the
-- two real accounts to vote before the MVP can auto-announce.
--
-- Run this in the Offside Supabase SQL Editor. Before running, replace the
-- two email values below with accounts that have logged into Offside once.

begin;

do $$
declare
  v_host_email text := 'rishabh0407@gmail.com';
  v_player_email text := 'rishabh.cmu@gmail.com';
  v_host record;
  v_player record;
  v_game_id uuid := gen_random_uuid();
begin
  if v_host_email = 'REPLACE_WITH_HOST_EMAIL'
     or v_player_email = 'REPLACE_WITH_NORMAL_PLAYER_EMAIL' then
    raise exception 'Edit v_host_email and v_player_email at the top of backend/qa_16_player_seed.sql before running it.';
  end if;

  if lower(v_host_email) = lower(v_player_email) then
    raise exception 'Use two different emails: one host account and one normal-player account.';
  end if;

  select id, email, full_name, profile_photo
  into v_host
  from public.users
  where lower(email) = lower(v_host_email)
  limit 1;

  if v_host.id is null then
    raise exception 'No public.users row found for host %. Log into Offside once with that account, then run this again.', v_host_email;
  end if;

  select id, email, full_name, profile_photo
  into v_player
  from public.users
  where lower(email) = lower(v_player_email)
  limit 1;

  if v_player.id is null then
    raise exception 'No public.users row found for normal player %. Log into Offside once with that account, then run this again.', v_player_email;
  end if;

  create temp table qa_affected_users on commit drop as
  select distinct rsvp.user_id
  from public.rsvps rsvp
  join public.games game on game.id = rsvp.game_id
  where game.title like 'OFFSIDE QA - %';

  delete from public.games
  where title like 'OFFSIDE QA - %';

  create temp table qa_bot_seed (
    rn integer primary key,
    email text not null unique,
    full_name text not null,
    favourite_club text not null
  ) on commit drop;

  insert into qa_bot_seed (rn, email, full_name, favourite_club) values
    (3,  'offside.qa.player.01@example.invalid', 'Ayaan Khan', 'Arsenal'),
    (4,  'offside.qa.player.02@example.invalid', 'Leo Martinez', 'Barcelona'),
    (5,  'offside.qa.player.03@example.invalid', 'Noah Wilson', 'Liverpool'),
    (6,  'offside.qa.player.04@example.invalid', 'Milan Shah', 'Real Madrid'),
    (7,  'offside.qa.player.05@example.invalid', 'Sam Carter', 'Chelsea'),
    (8,  'offside.qa.player.06@example.invalid', 'Omar Ali', 'Manchester City'),
    (9,  'offside.qa.player.07@example.invalid', 'Ethan Brooks', 'Tottenham'),
    (10, 'offside.qa.player.08@example.invalid', 'Ravi Patel', 'Manchester United'),
    (11, 'offside.qa.player.09@example.invalid', 'Mateo Rossi', 'Inter Milan'),
    (12, 'offside.qa.player.10@example.invalid', 'Daniel Kim', 'Bayern Munich'),
    (13, 'offside.qa.player.11@example.invalid', 'Arjun Mehta', 'Juventus'),
    (14, 'offside.qa.player.12@example.invalid', 'Lucas Silva', 'PSG'),
    (15, 'offside.qa.player.13@example.invalid', 'Ibrahim Hassan', 'AC Milan'),
    (16, 'offside.qa.player.14@example.invalid', 'Ben Turner', 'Dortmund');

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  select
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    bot.email,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', bot.full_name),
    now(),
    now()
  from qa_bot_seed bot
  where not exists (
    select 1
    from auth.users existing
    where lower(existing.email) = lower(bot.email)
  );

  insert into public.users (
    id,
    email,
    full_name,
    favourite_club,
    role,
    profile_photo
  )
  select
    auth_user.id,
    auth_user.email,
    bot.full_name,
    bot.favourite_club,
    'user',
    ''
  from qa_bot_seed bot
  join auth.users auth_user on lower(auth_user.email) = lower(bot.email)
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    favourite_club = excluded.favourite_club,
    role = excluded.role;

  create temp table qa_players (
    rn integer primary key,
    user_id uuid not null,
    user_name text not null,
    user_photo text not null
  ) on commit drop;

  insert into qa_players (rn, user_id, user_name, user_photo)
  values
    (
      1,
      v_host.id,
      coalesce(nullif(v_host.full_name, ''), split_part(v_host.email, '@', 1), 'Host'),
      coalesce(v_host.profile_photo, '')
    ),
    (
      2,
      v_player.id,
      coalesce(nullif(v_player.full_name, ''), split_part(v_player.email, '@', 1), 'Player'),
      coalesce(v_player.profile_photo, '')
    );

  insert into qa_players (rn, user_id, user_name, user_photo)
  select
    bot.rn,
    player.id,
    player.full_name,
    coalesce(player.profile_photo, '')
  from qa_bot_seed bot
  join public.users player on lower(player.email) = lower(bot.email);

  insert into public.games (
    id,
    title,
    date,
    location_name,
    max_players,
    rules,
    status,
    host_id,
    host_name,
    host_photo,
    dark_team,
    white_team,
    teams_announced
  ) values (
    v_game_id,
    'OFFSIDE QA - 16 Player Lifecycle',
    now() + interval '3 days',
    'QA Training Ground',
    16,
    'Disposable lifecycle test. As host, announce teams, end the game, approve stats, and watch MVP auto-announce.',
    'upcoming',
    v_host.id,
    coalesce(nullif(v_host.full_name, ''), split_part(v_host.email, '@', 1), 'Host'),
    coalesce(v_host.profile_photo, ''),
    '[]'::jsonb,
    '[]'::jsonb,
    false
  );

  insert into public.rsvps (game_id, user_id, user_name, user_photo, status)
  select v_game_id, player.user_id, player.user_name, player.user_photo, 'going'
  from qa_players player
  on conflict (game_id, user_id) do update set
    user_name = excluded.user_name,
    user_photo = excluded.user_photo,
    status = 'going';

  update public.games
  set
    dark_team = (
      select jsonb_agg(jsonb_build_object(
        'user_id', user_id,
        'name', user_name,
        'photo', user_photo
      ) order by rn)
      from qa_players
      where rn <= 8
    ),
    white_team = (
      select jsonb_agg(jsonb_build_object(
        'user_id', user_id,
        'name', user_name,
        'photo', user_photo
      ) order by rn)
      from qa_players
      where rn > 8
    )
  where id = v_game_id;

  insert into public.motm_votes (
    game_id,
    voter_id,
    voted_for_id,
    voted_for_name
  )
  select
    v_game_id,
    voter.user_id,
    candidate.user_id,
    candidate.user_name
  from qa_players voter
  join qa_players candidate on candidate.rn = 2
  where voter.rn >= 3
  on conflict (game_id, voter_id) do update set
    voted_for_id = excluded.voted_for_id,
    voted_for_name = excluded.voted_for_name;

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    game_id,
    dedupe_key
  ) values (
    v_player.id,
    'game_update',
    'QA game is ready',
    'This is a seeded notification for your normal-player test account.',
    v_game_id,
    'qa-ready-' || v_game_id || '-' || v_player.id
  )
  on conflict (dedupe_key) do nothing;

  with affected as (
    select user_id from qa_affected_users
    union
    select user_id from qa_players
  ),
  career as (
    select
      affected.user_id,
      coalesce((
        select sum(stats.goals)::integer
        from public.stat_submissions stats
        where stats.user_id = affected.user_id
          and stats.status = 'approved'
      ), 0) as total_goals,
      coalesce((
        select sum(stats.assists)::integer
        from public.stat_submissions stats
        where stats.user_id = affected.user_id
          and stats.status = 'approved'
      ), 0) as total_assists,
      coalesce((
        select count(distinct rsvp.game_id)::integer
        from public.rsvps rsvp
        join public.games game on game.id = rsvp.game_id
        where rsvp.user_id = affected.user_id
          and rsvp.status = 'going'
          and game.status = 'completed'
      ), 0) as games_played,
      coalesce((
        select count(*)::integer
        from public.games game
        where game.mvp_user_id = affected.user_id
      ), 0) as total_mvps
    from affected
  )
  update public.users profile
  set
    total_goals = career.total_goals,
    total_assists = career.total_assists,
    games_played = career.games_played,
    total_mvps = career.total_mvps
  from career
  where profile.id = career.user_id;

  raise notice 'Created QA game: %', v_game_id;
end $$;

commit;
