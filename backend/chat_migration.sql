create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  user_name text,
  user_photo text default '',
  content text not null,
  mention_user_ids text[] not null default '{}',
  parent_id text not null default '',
  likes text[] not null default '{}',
  dislikes text[] not null default '{}',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

alter table public.comments
  add column if not exists mention_user_ids text[] not null default '{}',
  add column if not exists parent_id text not null default '',
  add column if not exists likes text[] not null default '{}',
  add column if not exists dislikes text[] not null default '{}';

alter table public.notifications
  add column if not exists dedupe_key text unique;

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in ('teams_announced', 'submit_stats', 'stats_approved', 'mvp_awarded', 'rsvp_accepted', 'waitlist', 'game_update', 'mention'));

create index if not exists comments_game_parent_idx on public.comments(game_id, parent_id, created_date);

drop trigger if exists comments_set_updated_date on public.comments;
create trigger comments_set_updated_date before update on public.comments for each row execute function public.set_updated_date();

alter table public.comments enable row level security;

grant select, insert, update, delete on table public.comments to authenticated;
grant select on table public.comments to anon;

drop policy if exists "Authenticated users can read comments" on public.comments;
create policy "Authenticated users can read comments" on public.comments for select to authenticated using (true);
drop policy if exists "Users can create own comments" on public.comments;
create policy "Users can create own comments" on public.comments for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Authenticated users can update comment reactions" on public.comments;
create policy "Authenticated users can update comment reactions" on public.comments for update to authenticated using (true) with check (true);
