-- ============================================================================
--  Migration 0041 — Wave E (part 1): marketing — storefront popup + loyalty.
--  businesses gains popup config + loyalty config. loyalty_points holds each
--  signed-in shopper's balance per business; points are earned on completed
--  orders and redeemable as a discount at checkout. Applied via MCP.
-- ============================================================================

alter table public.businesses
  add column if not exists popup_enabled boolean not null default false,
  add column if not exists popup_title text,
  add column if not exists popup_text text,
  add column if not exists popup_coupon text,
  add column if not exists loyalty_enabled boolean not null default false,
  add column if not exists loyalty_earn numeric not null default 1,    -- points per ₪1 spent
  add column if not exists loyalty_value numeric not null default 0.1; -- ₪ value per point

create table if not exists public.loyalty_points (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_user_id uuid not null references auth.users(id) on delete cascade,
  points int not null default 0,
  updated_at timestamptz not null default now(),
  unique (business_id, customer_user_id)
);
create index if not exists idx_loyalty_points_business on public.loyalty_points (business_id);
alter table public.loyalty_points enable row level security;
-- Owner can read all balances for their business; a shopper can read their own.
drop policy if exists "loyalty_points_owner" on public.loyalty_points;
create policy "loyalty_points_owner" on public.loyalty_points
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
drop policy if exists "loyalty_points_self" on public.loyalty_points;
create policy "loyalty_points_self" on public.loyalty_points
  for select using (customer_user_id = auth.uid());
