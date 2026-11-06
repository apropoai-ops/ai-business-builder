-- ============================================================================
--  Migration 0051 — Purchased add-ons (Stripe subscription mirror, N:1 user).
--  A user may purchase any number of add-ons (lib/plans.ts ADDONS) as separate
--  Stripe "subscription" mode Checkout Sessions (see
--  lib/services/addons.service.ts). This table is the local mirror the app
--  reads to decide whether an add-on is active — writes are service-role only
--  (webhook-driven), mirroring the subscriptions table pattern from 0014.
-- ============================================================================

create table if not exists public.purchased_addons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  addon_key text not null,
  stripe_subscription_id text not null,
  stripe_item_id text,
  status text not null default 'active', -- 'active' | 'canceled'
  created_at timestamptz not null default now(),
  canceled_at timestamptz
);

alter table public.purchased_addons enable row level security;

create policy "purchased_addons_owner_read" on public.purchased_addons
  for select using ((select auth.uid()) = user_id);

-- Idempotency: one row per Stripe subscription (webhook may redeliver).
create unique index if not exists purchased_addons_stripe_subscription_id_key
  on public.purchased_addons (stripe_subscription_id);

create index if not exists purchased_addons_user_id_idx
  on public.purchased_addons (user_id);
