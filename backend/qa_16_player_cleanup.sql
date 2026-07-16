-- Removes data created by backend/qa_16_player_seed.sql.
-- Run this in the Supabase SQL Editor when QA is done.

begin;

create temp table qa_affected_users on commit drop as
select distinct rsvp.user_id
from public.rsvps rsvp
join public.games game on game.id = rsvp.game_id
where game.title like 'OFFSIDE QA - %';

delete from public.games
where title like 'OFFSIDE QA - %';

delete from auth.users
where email like 'offside.qa.player.%@example.invalid';

with career as (
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
  from qa_affected_users affected
)
update public.users profile
set
  total_goals = career.total_goals,
  total_assists = career.total_assists,
  games_played = career.games_played,
  total_mvps = career.total_mvps
from career
where profile.id = career.user_id;

commit;
