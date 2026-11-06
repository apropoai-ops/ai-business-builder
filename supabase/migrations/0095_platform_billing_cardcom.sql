-- 0095: interim platform billing via the merchant's own Cardcom account.
-- Stripe Live could not be activated for this business (Israeli sole
-- proprietor), so the platform's OWN monthly plan subscription (starter/pro/
-- business, charged to the business owners who buy a package) moves to a
-- Cardcom Low-Profile one-time charge, re-run by hand each month until real
-- recurring billing (token + cron) is built. Reuses the same GatewayDriver
-- contract + server-side verification the store checkout already relies on.
--
-- provider/provider_ref on subscriptions distinguish which rail activated a
-- row (existing Stripe rows implicitly stay 'stripe' via the default).
alter table public.subscriptions
  add column if not exists provider text not null default 'stripe',
  add column if not exists provider_ref text;

-- One row per checkout attempt, looked up by id (Cardcom's ReturnValue) when
-- the payment callback arrives. Mirrors subscriptions: owner gets read-only
-- RLS, every write goes through service-role server code (no insert/update/
-- delete policy for authenticated/anon at all — the 0083/0085 lesson).
create table if not exists public.platform_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan plan_tier not null,
  amount numeric not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  provider text not null default 'cardcom',
  provider_ref text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
alter table public.platform_charges enable row level security;
create policy "platform_charges_owner_read" on public.platform_charges
  for select using ((select auth.uid()) = user_id);
