-- ============================================================================
--  Migration 0014 — Billing foundation (applied via MCP).
--  subscriptions (Stripe mirror, 1:1 user) · usage_counters (monthly, per
--  business) · bump_usage RPC (atomic increment, service-role only).
--  Owners get read-only RLS; all writes go through service-role server code.
-- ============================================================================

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan plan_tier not null default 'free',
  status text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "subscriptions_owner_read" on public.subscriptions
  for select using ((select auth.uid()) = user_id);

create table if not exists public.usage_counters (
  business_id uuid not null references public.businesses(id) on delete cascade,
  period text not null, -- 'YYYY-MM'
  ai_generations int not null default 0,
  ai_chat_msgs int not null default 0,
  primary key (business_id, period)
);
alter table public.usage_counters enable row level security;
create policy "usage_owner_read" on public.usage_counters
  for select using (is_business_owner(business_id));

create or replace function public.bump_usage(
  p_business_id uuid,
  p_field text,
  p_period text
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare new_count int;
begin
  if p_field not in ('ai_generations', 'ai_chat_msgs') then
    raise exception 'invalid usage field %', p_field;
  end if;

  insert into usage_counters (business_id, period)
  values (p_business_id, p_period)
  on conflict (business_id, period) do nothing;

  if p_field = 'ai_generations' then
    update usage_counters set ai_generations = ai_generations + 1
      where business_id = p_business_id and period = p_period
      returning ai_generations into new_count;
  else
    update usage_counters set ai_chat_msgs = ai_chat_msgs + 1
      where business_id = p_business_id and period = p_period
      returning ai_chat_msgs into new_count;
  end if;

  return new_count;
end;
$$;
revoke execute on function public.bump_usage(uuid, text, text) from anon, authenticated;
