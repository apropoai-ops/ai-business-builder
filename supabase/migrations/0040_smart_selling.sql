-- ============================================================================
--  Migration 0040 — Wave D: smart selling.
--  coupons.customer_phone: optional targeting (a personal coupon valid only for
--  that shopper's phone). products.cost_price: unit cost for profit analytics.
--  abandoned_carts: carts a (mostly logged-in) shopper started but didn't check
--  out, so the owner can follow up. Applied via MCP.
-- ============================================================================

alter table public.coupons
  add column if not exists customer_phone text;

alter table public.products
  add column if not exists cost_price numeric;

create table if not exists public.abandoned_carts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_user_id uuid references auth.users(id) on delete set null,
  customer_name text,
  customer_phone text,
  items jsonb,
  total numeric,
  recovered boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_abandoned_carts_business
  on public.abandoned_carts (business_id, recovered, updated_at desc);
-- One open cart per identified shopper per business (phone-keyed).
create unique index if not exists uq_abandoned_carts_biz_phone
  on public.abandoned_carts (business_id, customer_phone)
  where customer_phone is not null;
alter table public.abandoned_carts enable row level security;
drop policy if exists "abandoned_carts_owner_all" on public.abandoned_carts;
create policy "abandoned_carts_owner_all" on public.abandoned_carts
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
