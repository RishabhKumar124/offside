-- Moves team announcement fan-out into the database so it always uses the
-- current confirmed player list instead of possibly stale browser state.

begin;

create or replace function public.announce_teams(p_game_id uuid)
returns table(game_id uuid, notified_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.games;
  v_notified_count integer := 0;
begin
  if p_game_id is null then
    raise exception 'Game id is required';
  end if;

  select *
  into v_game
  from public.games
  where id = p_game_id
  for update;

  if v_game.id is null then
    raise exception 'Game not found';
  end if;

  if auth.uid() is not null
     and v_game.host_id <> auth.uid()
     and not public.is_admin() then
    raise exception 'Only the host can announce teams';
  end if;

  update public.games
  set teams_announced = true
  where id = p_game_id
  returning * into v_game;

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    game_id,
    dedupe_key
  )
  select
    rsvp.user_id,
    'teams_announced',
    'Teams Announced!',
    'Teams for "' || v_game.title || '" have been set. Check which team you are on!',
    p_game_id,
    'teams-announced-' || p_game_id || '-' || rsvp.user_id
  from public.rsvps rsvp
  where rsvp.game_id = p_game_id
    and rsvp.status = 'going'
  on conflict (dedupe_key) do update set
    title = excluded.title,
    message = excluded.message,
    read = false,
    updated_date = now();

  get diagnostics v_notified_count = row_count;

  return query select p_game_id, v_notified_count;
end;
$$;

grant execute on function public.announce_teams(uuid) to authenticated;

commit;
