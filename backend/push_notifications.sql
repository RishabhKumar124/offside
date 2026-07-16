-- Native push notification support for Offside.
--
-- Run this in the Offside Supabase SQL Editor before deploying the
-- dispatch-push-notifications Edge Function.

begin;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'android' check (platform in ('android', 'ios', 'web')),
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create index if not exists push_tokens_user_active_idx
  on public.push_tokens(user_id, active);

create table if not exists public.push_delivery_queue (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade unique,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create index if not exists push_delivery_queue_status_next_idx
  on public.push_delivery_queue(status, next_attempt_at);

drop trigger if exists push_tokens_set_updated_date on public.push_tokens;
create trigger push_tokens_set_updated_date
before update on public.push_tokens
for each row execute function public.set_updated_date();

drop trigger if exists push_delivery_queue_set_updated_date on public.push_delivery_queue;
create trigger push_delivery_queue_set_updated_date
before update on public.push_delivery_queue
for each row execute function public.set_updated_date();

create or replace function public.register_push_token(
  p_token text,
  p_platform text default 'android'
)
returns public.push_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.push_tokens;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(p_token), '') is null then
    raise exception 'Push token is required';
  end if;

  if p_platform not in ('android', 'ios', 'web') then
    raise exception 'Unsupported push platform: %', p_platform;
  end if;

  insert into public.push_tokens (
    user_id,
    token,
    platform,
    active,
    last_seen_at
  ) values (
    auth.uid(),
    trim(p_token),
    p_platform,
    true,
    now()
  )
  on conflict (token) do update set
    user_id = auth.uid(),
    platform = excluded.platform,
    active = true,
    last_seen_at = now()
  returning * into v_token;

  return v_token;
end;
$$;

create or replace function public.deactivate_push_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  update public.push_tokens
  set active = false
  where token = p_token
    and user_id = auth.uid();

  return true;
end;
$$;

create or replace function public.enqueue_push_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.push_delivery_queue (
    notification_id,
    user_id,
    status,
    next_attempt_at
  ) values (
    new.id,
    new.user_id,
    'pending',
    now()
  )
  on conflict (notification_id) do nothing;

  return new;
end;
$$;

drop trigger if exists notifications_enqueue_push_delivery on public.notifications;
create trigger notifications_enqueue_push_delivery
after insert on public.notifications
for each row execute function public.enqueue_push_delivery();

alter table public.push_tokens enable row level security;
alter table public.push_delivery_queue enable row level security;

grant select, insert, update, delete on table public.push_tokens to authenticated;
grant select, update on table public.notifications to service_role;
grant select, update on table public.push_tokens to service_role;
grant select, insert, update, delete on table public.push_delivery_queue to service_role;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.deactivate_push_token(text) to authenticated;

drop policy if exists "Users can read own push tokens" on public.push_tokens;
create policy "Users can read own push tokens"
on public.push_tokens for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can update own push tokens" on public.push_tokens;
create policy "Users can update own push tokens"
on public.push_tokens for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can delete own push tokens" on public.push_tokens;
create policy "Users can delete own push tokens"
on public.push_tokens for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());

commit;
