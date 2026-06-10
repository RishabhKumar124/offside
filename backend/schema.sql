create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'user', 'host')),
  birthday date,
  profile_photo text default '',
  about_me text default '',
  favourite_club text default '',
  total_goals integer not null default 0,
  total_assists integer not null default 0,
  total_mvps integer not null default 0,
  games_played integer not null default 0,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date timestamptz not null,
  location_name text not null,
  location_lat double precision,
  location_lng double precision,
  max_players integer not null check (max_players > 0),
  rules text default '',
  status text not null default 'upcoming' check (status in ('upcoming', 'in_progress', 'completed', 'cancelled')),
  host_id uuid not null references public.users(id) on delete cascade,
  host_name text,
  host_photo text default '',
  dark_team jsonb not null default '[]'::jsonb,
  white_team jsonb not null default '[]'::jsonb,
  dark_score integer,
  white_score integer,
  mvp_user_id uuid references public.users(id) on delete set null,
  mvp_name text,
  stats_locked boolean not null default false,
  teams_announced boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  user_name text,
  user_photo text default '',
  status text not null default 'going' check (status in ('going', 'waitlist', 'declined', 'removed')),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (game_id, user_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('teams_announced', 'submit_stats', 'stats_approved', 'mvp_awarded', 'rsvp_accepted', 'waitlist', 'game_update', 'mention')),
  title text not null,
  message text not null,
  game_id uuid references public.games(id) on delete cascade,
  read boolean not null default false,
  dedupe_key text unique,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.motm_votes (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  voter_id uuid not null references public.users(id) on delete cascade,
  voted_for_id uuid not null references public.users(id) on delete cascade,
  voted_for_name text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (game_id, voter_id)
);

create table if not exists public.stat_submissions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  user_name text,
  goals integer not null default 0 check (goals >= 0),
  assists integer not null default 0 check (assists >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (game_id, user_id)
);

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

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text not null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('host_password', 'cesurtheman')
on conflict (key) do nothing;

create index if not exists games_status_date_idx on public.games(status, date);
create index if not exists rsvps_game_status_idx on public.rsvps(game_id, status);
create index if not exists notifications_user_read_idx on public.notifications(user_id, read, created_date desc);
create index if not exists stat_submissions_game_status_idx on public.stat_submissions(game_id, status);
create index if not exists comments_game_parent_idx on public.comments(game_id, parent_id, created_date);

create or replace function public.set_updated_date()
returns trigger
language plpgsql
as $$
begin
  new.updated_date = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_date on public.users;
create trigger users_set_updated_date before update on public.users for each row execute function public.set_updated_date();
drop trigger if exists games_set_updated_date on public.games;
create trigger games_set_updated_date before update on public.games for each row execute function public.set_updated_date();
drop trigger if exists rsvps_set_updated_date on public.rsvps;
create trigger rsvps_set_updated_date before update on public.rsvps for each row execute function public.set_updated_date();
drop trigger if exists notifications_set_updated_date on public.notifications;
create trigger notifications_set_updated_date before update on public.notifications for each row execute function public.set_updated_date();
drop trigger if exists motm_votes_set_updated_date on public.motm_votes;
create trigger motm_votes_set_updated_date before update on public.motm_votes for each row execute function public.set_updated_date();
drop trigger if exists stat_submissions_set_updated_date on public.stat_submissions;
create trigger stat_submissions_set_updated_date before update on public.stat_submissions for each row execute function public.set_updated_date();
drop trigger if exists comments_set_updated_date on public.comments;
create trigger comments_set_updated_date before update on public.comments for each row execute function public.set_updated_date();
drop trigger if exists app_settings_set_updated_date on public.app_settings;
create trigger app_settings_set_updated_date before update on public.app_settings for each row execute function public.set_updated_date();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.users where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_game_host(target_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.games where id = target_game_id and host_id = auth.uid());
$$;

create or replace function public.create_game(
  p_title text,
  p_date timestamptz,
  p_location_name text,
  p_location_lat double precision,
  p_location_lng double precision,
  p_max_players integer,
  p_rules text,
  p_host_name text,
  p_host_photo text
)
returns public.games
language plpgsql
security definer
set search_path = public
as $$
declare
  new_game public.games;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.games (
    title,
    date,
    location_name,
    location_lat,
    location_lng,
    max_players,
    rules,
    status,
    host_id,
    host_name,
    host_photo,
    dark_team,
    white_team,
    stats_locked,
    teams_announced
  ) values (
    p_title,
    p_date,
    p_location_name,
    p_location_lat,
    p_location_lng,
    p_max_players,
    p_rules,
    'upcoming',
    auth.uid(),
    p_host_name,
    p_host_photo,
    '[]'::jsonb,
    '[]'::jsonb,
    false,
    false
  )
  returning * into new_game;

  insert into public.rsvps (
    game_id,
    user_id,
    user_name,
    user_photo,
    status
  ) values (
    new_game.id,
    auth.uid(),
    p_host_name,
    p_host_photo,
    'going'
  )
  on conflict (game_id, user_id) do update set
    user_name = excluded.user_name,
    user_photo = excluded.user_photo,
    status = 'going';

  return new_game;
end;
$$;

alter table public.users enable row level security;
alter table public.games enable row level security;
alter table public.rsvps enable row level security;
alter table public.notifications enable row level security;
alter table public.motm_votes enable row level security;
alter table public.stat_submissions enable row level security;
alter table public.comments enable row level security;
alter table public.app_settings enable row level security;

grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on table public.users to authenticated;
grant select, insert, update, delete on table public.games to authenticated;
grant select, insert, update, delete on table public.rsvps to authenticated;
grant select, insert, update, delete on table public.notifications to authenticated;
grant select, insert, update, delete on table public.motm_votes to authenticated;
grant select, insert, update, delete on table public.stat_submissions to authenticated;
grant select, insert, update, delete on table public.comments to authenticated;
grant select, insert, update, delete on table public.app_settings to authenticated;

grant select on table public.users to anon;
grant select on table public.games to anon;
grant select on table public.rsvps to anon;
grant select on table public.notifications to anon;
grant select on table public.motm_votes to anon;
grant select on table public.stat_submissions to anon;
grant select on table public.comments to anon;
grant select on table public.app_settings to anon;

grant execute on function public.create_game(text, timestamptz, text, double precision, double precision, integer, text, text, text) to authenticated;

drop policy if exists "Users can read profiles" on public.users;
create policy "Users can read profiles" on public.users for select to authenticated using (true);
drop policy if exists "Users can insert own profile" on public.users;
create policy "Users can insert own profile" on public.users for insert to authenticated with check (id = auth.uid());
drop policy if exists "Users can update own profile" on public.users;
create policy "Users can update own profile" on public.users for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

drop policy if exists "Authenticated users can read games" on public.games;
create policy "Authenticated users can read games" on public.games for select to authenticated using (true);
drop policy if exists "Authenticated users can create games" on public.games;
create policy "Authenticated users can create games" on public.games for insert to authenticated with check (host_id = auth.uid());
drop policy if exists "Hosts and admins can update games" on public.games;
create policy "Hosts and admins can update games" on public.games for update to authenticated using (host_id = auth.uid() or public.is_admin()) with check (host_id = auth.uid() or public.is_admin());

drop policy if exists "Authenticated users can read rsvps" on public.rsvps;
create policy "Authenticated users can read rsvps" on public.rsvps for select to authenticated using (true);
drop policy if exists "Users can create own rsvps" on public.rsvps;
create policy "Users can create own rsvps" on public.rsvps for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Users hosts admins can update rsvps" on public.rsvps;
create policy "Users hosts admins can update rsvps" on public.rsvps for update to authenticated using (user_id = auth.uid() or public.is_game_host(game_id) or public.is_admin()) with check (user_id = auth.uid() or public.is_game_host(game_id) or public.is_admin());
drop policy if exists "Users hosts admins can delete rsvps" on public.rsvps;
create policy "Users hosts admins can delete rsvps" on public.rsvps for delete to authenticated using (user_id = auth.uid() or public.is_game_host(game_id) or public.is_admin());

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications" on public.notifications for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "Authenticated users can create notifications" on public.notifications;
create policy "Authenticated users can create notifications" on public.notifications for insert to authenticated with check (true);
drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications" on public.notifications for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "Authenticated users can read motm votes" on public.motm_votes;
create policy "Authenticated users can read motm votes" on public.motm_votes for select to authenticated using (true);
drop policy if exists "Users can create own motm votes" on public.motm_votes;
create policy "Users can create own motm votes" on public.motm_votes for insert to authenticated with check (voter_id = auth.uid());
drop policy if exists "Users can update own motm votes" on public.motm_votes;
create policy "Users can update own motm votes" on public.motm_votes for update to authenticated using (voter_id = auth.uid()) with check (voter_id = auth.uid());

drop policy if exists "Authenticated users can read stat submissions" on public.stat_submissions;
create policy "Authenticated users can read stat submissions" on public.stat_submissions for select to authenticated using (true);
drop policy if exists "Users can create own stat submissions" on public.stat_submissions;
create policy "Users can create own stat submissions" on public.stat_submissions for insert to authenticated with check (user_id = auth.uid() or public.is_game_host(game_id) or public.is_admin());
drop policy if exists "Users hosts admins can update stat submissions" on public.stat_submissions;
create policy "Users hosts admins can update stat submissions" on public.stat_submissions for update to authenticated using (user_id = auth.uid() or public.is_game_host(game_id) or public.is_admin()) with check (user_id = auth.uid() or public.is_game_host(game_id) or public.is_admin());

drop policy if exists "Authenticated users can read comments" on public.comments;
create policy "Authenticated users can read comments" on public.comments for select to authenticated using (true);
drop policy if exists "Users can create own comments" on public.comments;
create policy "Users can create own comments" on public.comments for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Authenticated users can update comment reactions" on public.comments;
create policy "Authenticated users can update comment reactions" on public.comments for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can read app settings" on public.app_settings;
create policy "Authenticated users can read app settings" on public.app_settings for select to authenticated using (true);
drop policy if exists "Admins can insert app settings" on public.app_settings;
create policy "Admins can insert app settings" on public.app_settings for insert to authenticated with check (public.is_admin());
drop policy if exists "Admins can update app settings" on public.app_settings;
create policy "Admins can update app settings" on public.app_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

drop policy if exists "Profile photos are public" on storage.objects;
create policy "Profile photos are public" on storage.objects for select using (bucket_id = 'profile-photos');
drop policy if exists "Users can upload own profile photos" on storage.objects;
create policy "Users can upload own profile photos" on storage.objects for insert to authenticated with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users can update own profile photos" on storage.objects;
create policy "Users can update own profile photos" on storage.objects for update to authenticated using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
