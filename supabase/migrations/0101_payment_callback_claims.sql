-- 0101 — one provider transaction can settle exactly one order.
--
-- Several gateway drivers (Tranzila, Grow, iCredit) verify the TRANSACTION
-- server-to-server but read OUR order id from the callback body, which is
-- attacker-supplied. Without a ledger, a shopper could pay a cheap order once
-- and replay that genuine transaction id with a different (expensive) order id.
-- The callback route claims (provider, provider_ref) here before finalizing;
-- a second claim for a different order is rejected.
--
-- Service-role only: RLS on with no policies, and no grants to API roles.

create table if not exists public.payment_callback_claims (
  provider      text        not null,
  provider_ref  text        not null,
  business_id   uuid        not null references public.businesses(id) on delete cascade,
  order_id      text        not null,
  created_at    timestamptz not null default now(),
  primary key (provider, provider_ref)
);

create index if not exists payment_callback_claims_business_idx
  on public.payment_callback_claims (business_id);

alter table public.payment_callback_claims enable row level security;
revoke all on public.payment_callback_claims from anon, authenticated;
