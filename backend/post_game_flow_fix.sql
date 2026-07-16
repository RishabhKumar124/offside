-- Post-game workflow fixes for Offside.
--
-- Run this in the Offside Supabase SQL Editor.
-- It moves stat approval, score/MVP saving, MVP auto-finalization, and
-- completed-game totals into security-definer functions so host actions are
-- not blocked by user-profile RLS.

begin;

alter table public.games
  add column if not exists completed_date timestamptz;

alter table public.games
  add column if not exists mvp_announced_at timestamptz;

alter table public.notifications
  add column if not exists dedupe_key text;

create unique index if not exists notifications_dedupe_key_idx
  on public.notifications(dedupe_key);

create or replace function public.set_game_completed_date()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completed'
     and old.status is distinct from 'completed'
     and new.completed_date is null then
    new.completed_date = now();
  end if;

  if new.status is distinct from 'completed' then
    new.completed_date = null;
    new.mvp_announced_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists games_set_completed_date on public.games;
create trigger games_set_completed_date
before update on public.games
for each row execute function public.set_game_completed_date();

create or replace function public.recalculate_user_career_totals(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users profile
  set
    total_goals = coalesce((
      select sum(stats.goals)::integer
      from public.stat_submissions stats
      where stats.user_id = p_user_id
        and stats.status = 'approved'
    ), 0),
    total_assists = coalesce((
      select sum(stats.assists)::integer
      from public.stat_submissions stats
      where stats.user_id = p_user_id
        and stats.status = 'approved'
    ), 0),
    games_played = coalesce((
      select count(distinct rsvp.game_id)::integer
      from public.rsvps rsvp
      join public.games game on game.id = rsvp.game_id
      where rsvp.user_id = p_user_id
        and rsvp.status = 'going'
        and game.status = 'completed'
    ), 0),
    total_mvps = coalesce((
      select count(*)::integer
      from public.games game
      where game.mvp_user_id = p_user_id
    ), 0)
  where profile.id = p_user_id;
end;
$$;

create or replace function public.complete_game(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games;
  v_player record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_game
  from public.games
  where id = p_game_id
  for update;

  if v_game.id is null then
    raise exception 'Game not found';
  end if;

  if v_game.host_id <> auth.uid() and not public.is_admin() then
    raise exception 'Only the host can complete this game';
  end if;

  update public.games
  set status = 'completed'
  where id = p_game_id
  returning * into v_game;

  for v_player in
    select user_id
    from public.rsvps
    where game_id = p_game_id
      and status = 'going'
  loop
    perform public.recalculate_user_career_totals(v_player.user_id);

    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      game_id,
      dedupe_key
    ) values (
      v_player.user_id,
      'submit_stats',
      'Game over. Submit your stats',
      '"' || v_game.title || '" has ended. Submit your goals and assists.',
      p_game_id,
      'submit-stats-' || p_game_id || '-' || v_player.user_id
    )
    on conflict (dedupe_key) do update set
      read = false,
      updated_date = now();
  end loop;

  return v_game;
end;
$$;

create or replace function public.approve_stat_submission(p_stat_id uuid)
returns public.stat_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stat public.stat_submissions;
  v_game public.games;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_stat
  from public.stat_submissions
  where id = p_stat_id
  for update;

  if v_stat.id is null then
    raise exception 'Stat submission not found';
  end if;

  select *
  into v_game
  from public.games
  where id = v_stat.game_id;

  if v_game.host_id <> auth.uid() and not public.is_admin() then
    raise exception 'Only the host can approve stats for this game';
  end if;

  update public.stat_submissions
  set status = 'approved'
  where id = p_stat_id
  returning * into v_stat;

  perform public.recalculate_user_career_totals(v_stat.user_id);

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    game_id,
    dedupe_key
  ) values (
    v_stat.user_id,
    'stats_approved',
    'Stats approved',
    'Your stats for "' || v_game.title || '" have been approved.',
    v_stat.game_id,
    'stats-approved-' || v_stat.id
  )
  on conflict (dedupe_key) do update set
    read = false,
    updated_date = now();

  return v_stat;
end;
$$;

create or replace function public.upsert_approved_stat_submission(
  p_game_id uuid,
  p_user_id uuid,
  p_user_name text,
  p_goals integer,
  p_assists integer
)
returns public.stat_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games;
  v_player_name text;
  v_stat public.stat_submissions;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_game
  from public.games
  where id = p_game_id;

  if v_game.id is null then
    raise exception 'Game not found';
  end if;

  if v_game.host_id <> auth.uid() and not public.is_admin() then
    raise exception 'Only the host can edit approved stats for this game';
  end if;

  select coalesce(nullif(rsvp.user_name, ''), nullif(profile.full_name, ''), p_user_name, 'Player')
  into v_player_name
  from public.rsvps rsvp
  left join public.users profile on profile.id = rsvp.user_id
  where rsvp.game_id = p_game_id
    and rsvp.user_id = p_user_id
    and rsvp.status = 'going'
  limit 1;

  if v_player_name is null then
    raise exception 'Player is not marked going for this game';
  end if;

  insert into public.stat_submissions (
    game_id,
    user_id,
    user_name,
    goals,
    assists,
    status
  ) values (
    p_game_id,
    p_user_id,
    v_player_name,
    greatest(coalesce(p_goals, 0), 0),
    greatest(coalesce(p_assists, 0), 0),
    'approved'
  )
  on conflict (game_id, user_id) do update set
    user_name = excluded.user_name,
    goals = excluded.goals,
    assists = excluded.assists,
    status = 'approved'
  returning * into v_stat;

  perform public.recalculate_user_career_totals(p_user_id);

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    game_id,
    dedupe_key
  ) values (
    p_user_id,
    'stats_approved',
    'Stats updated',
    'Your stats for "' || v_game.title || '" have been updated.',
    p_game_id,
    'stats-approved-' || v_stat.id
  )
  on conflict (dedupe_key) do update set
    read = false,
    updated_date = now();

  return v_stat;
end;
$$;

create or replace function public.save_score_and_mvp(
  p_game_id uuid,
  p_dark_score integer,
  p_white_score integer,
  p_mvp_user_id uuid
)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games;
  v_old_mvp_id uuid;
  v_mvp_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_game
  from public.games
  where id = p_game_id
  for update;

  if v_game.id is null then
    raise exception 'Game not found';
  end if;

  if v_game.host_id <> auth.uid() and not public.is_admin() then
    raise exception 'Only the host can save score and MVP';
  end if;

  v_old_mvp_id := v_game.mvp_user_id;

  if p_mvp_user_id is not null then
    select coalesce(nullif(rsvp.user_name, ''), nullif(profile.full_name, ''), 'Player')
    into v_mvp_name
    from public.rsvps rsvp
    left join public.users profile on profile.id = rsvp.user_id
    where rsvp.game_id = p_game_id
      and rsvp.user_id = p_mvp_user_id
      and rsvp.status = 'going'
    limit 1;

    if v_mvp_name is null then
      raise exception 'MVP must be a confirmed player in this game';
    end if;
  end if;

  update public.games
  set
    dark_score = greatest(coalesce(p_dark_score, 0), 0),
    white_score = greatest(coalesce(p_white_score, 0), 0),
    mvp_user_id = p_mvp_user_id,
    mvp_name = case when p_mvp_user_id is null then null else v_mvp_name end,
    mvp_announced_at = case
      when p_mvp_user_id is null then null
      when v_old_mvp_id is distinct from p_mvp_user_id then now()
      else mvp_announced_at
    end
  where id = p_game_id
  returning * into v_game;

  if v_old_mvp_id is not null then
    perform public.recalculate_user_career_totals(v_old_mvp_id);
  end if;

  if p_mvp_user_id is not null then
    perform public.recalculate_user_career_totals(p_mvp_user_id);

    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      game_id,
      dedupe_key
    ) values (
      p_mvp_user_id,
      'mvp_awarded',
      'You are the MVP',
      'You were selected as MVP for "' || v_game.title || '".',
      p_game_id,
      'mvp-awarded-' || p_game_id || '-' || p_mvp_user_id
    )
    on conflict (dedupe_key) do update set
      read = false,
      updated_date = now();
  end if;

  return v_game;
end;
$$;

create or replace function public.finalize_mvp_if_ready(p_game_id uuid)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games;
  v_voter_count integer;
  v_vote_count integer;
  v_deadline timestamptz;
  v_winner_id uuid;
  v_winner_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_game
  from public.games
  where id = p_game_id
  for update;

  if v_game.id is null then
    raise exception 'Game not found';
  end if;

  if v_game.host_id <> auth.uid()
     and not public.is_admin()
     and not exists (
       select 1
       from public.rsvps rsvp
       where rsvp.game_id = p_game_id
         and rsvp.user_id = auth.uid()
         and rsvp.status = 'going'
     ) then
    raise exception 'Only confirmed players can finalize MVP voting';
  end if;

  if v_game.status <> 'completed' or v_game.mvp_user_id is not null then
    return v_game;
  end if;

  select count(*)::integer
  into v_voter_count
  from public.rsvps
  where game_id = p_game_id
    and status = 'going';

  if coalesce(v_voter_count, 0) = 0 then
    return v_game;
  end if;

  select count(distinct vote.voter_id)::integer
  into v_vote_count
  from public.motm_votes vote
  join public.rsvps voter
    on voter.game_id = vote.game_id
   and voter.user_id = vote.voter_id
   and voter.status = 'going'
  join public.rsvps candidate
    on candidate.game_id = vote.game_id
   and candidate.user_id = vote.voted_for_id
   and candidate.status = 'going'
  where vote.game_id = p_game_id;

  v_deadline := coalesce(v_game.completed_date, v_game.updated_date, now()) + interval '2 hours';

  if coalesce(v_vote_count, 0) < v_voter_count and now() < v_deadline then
    return v_game;
  end if;

  select
    candidate.user_id,
    coalesce(nullif(candidate.user_name, ''), nullif(profile.full_name, ''), 'Player') as user_name
  into v_winner_id, v_winner_name
  from public.motm_votes vote
  join public.rsvps voter
    on voter.game_id = vote.game_id
   and voter.user_id = vote.voter_id
   and voter.status = 'going'
  join public.rsvps candidate
    on candidate.game_id = vote.game_id
   and candidate.user_id = vote.voted_for_id
   and candidate.status = 'going'
  left join public.users profile on profile.id = candidate.user_id
  where vote.game_id = p_game_id
  group by candidate.user_id, candidate.user_name, profile.full_name
  order by count(*) desc, max(vote.created_date) asc, candidate.user_name asc
  limit 1;

  if v_winner_id is null then
    return v_game;
  end if;

  update public.games
  set
    mvp_user_id = v_winner_id,
    mvp_name = v_winner_name,
    mvp_announced_at = now()
  where id = p_game_id
  returning * into v_game;

  perform public.recalculate_user_career_totals(v_winner_id);

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    game_id,
    dedupe_key
  ) values (
    v_winner_id,
    'mvp_awarded',
    'You are the MVP',
    'You were voted MVP for "' || v_game.title || '".',
    p_game_id,
    'mvp-awarded-' || p_game_id || '-' || v_winner_id
  )
  on conflict (dedupe_key) do update set
    read = false,
    updated_date = now();

  return v_game;
end;
$$;

grant execute on function public.complete_game(uuid) to authenticated;
grant execute on function public.approve_stat_submission(uuid) to authenticated;
grant execute on function public.upsert_approved_stat_submission(uuid, uuid, text, integer, integer) to authenticated;
grant execute on function public.save_score_and_mvp(uuid, integer, integer, uuid) to authenticated;
grant execute on function public.finalize_mvp_if_ready(uuid) to authenticated;

commit;
