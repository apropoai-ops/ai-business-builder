-- 0065: web-push subscriptions — browser push endpoints per user, so the
-- platform can notify business owners about new activity (orders, leads,
-- bookings) even when the dashboard tab is closed. Each row is one
-- browser/device subscription; a user may have several.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Users manage only their own subscriptions. Sending (reading endpoints for
-- an arbitrary user) happens server-side with the service-role client.
create policy "push_subscriptions_own_all" on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);
