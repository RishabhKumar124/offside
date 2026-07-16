-- Run this once in the Supabase SQL Editor for existing production data.
-- It makes every current game host a confirmed player and brings games_played
-- up to at least the number of completed games where a user is marked going.

begin;

insert into public.rsvps (
  game_id,
  user_id,
  user_name,
  user_photo,
  status
)
select
  g.id,
  g.host_id,
  coalesce(nullif(g.host_name, ''), u.full_name, 'Host'),
  coalesce(nullif(g.host_photo, ''), u.profile_photo, ''),
  'going'
from public.games g
left join public.users u on u.id = g.host_id
where g.host_id is not null
on conflict (game_id, user_id) do update set
  user_name = excluded.user_name,
  user_photo = excluded.user_photo,
  status = 'going';

with completed_players as (
  select
    r.user_id,
    count(distinct r.game_id)::integer as completed_games
  from public.rsvps r
  join public.games g on g.id = r.game_id
  where r.status = 'going'
    and g.status = 'completed'
  group by r.user_id
)
update public.users u
set games_played = greatest(coalesce(u.games_played, 0), completed_players.completed_games)
from completed_players
where u.id = completed_players.user_id;

commit;
