alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in ('teams_announced', 'submit_stats', 'stats_approved', 'mvp_awarded', 'rsvp_accepted', 'waitlist', 'game_update', 'mention'));

alter table public.comments
  add column if not exists mention_user_ids text[] not null default '{}';
