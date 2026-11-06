-- ============================================================================
--  Migration 0036 — Wave A: customer accounts (personal area on the storefront).
--  Store shoppers authenticate via Supabase Auth (shared auth.users). Identity
--  is global; the per-store relationship is implicit via their orders. Adds:
--    customer_profiles         — global per-user profile (name/phone), key = uid
--    customer_addresses        — saved shipping addresses (global to the user)
--    customer_payment_methods  — saved payment-method DISPLAY metadata only
--        (brand + last4 + expiry are PCI-safe; full PAN/CVV are NEVER stored.
--         Real card vaulting via Stripe SetupIntents lands in Wave B.)
--    orders.customer_user_id   — links an order to the signed-in shopper
--  Customers get RLS to read their OWN orders/order_items and fully manage
--  their own profile/addresses/payment methods. Owners keep per-business access.
--  Applied via MCP.
-- ============================================================================

-- ── Customer profile (one row per auth user, global across stores) ──────────
create table if not exists public.customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customer_profiles enable row level security;
drop policy if exists "customer_profiles_self" on public.customer_profiles;
create policy "customer_profiles_self" on public.customer_profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- ── Saved shipping addresses (global to the user, reusable across stores) ───
create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  recipient_name text not null,
  phone text not null,
  street text not null,
  city text not null,
  zip text,
  notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_customer_addresses_user
  on public.customer_addresses (user_id, created_at);
alter table public.customer_addresses enable row level security;
drop policy if exists "customer_addresses_self" on public.customer_addresses;
create policy "customer_addresses_self" on public.customer_addresses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Saved payment methods (DISPLAY metadata only in Wave A) ─────────────────
create table if not exists public.customer_payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  brand text,            -- visa / mastercard / amex / isracard / ...
  last4 text,            -- last 4 digits only (display) — never the full PAN
  exp_month int check (exp_month between 1 and 12),
  exp_year int check (exp_year between 2024 and 2100),
  provider text,         -- 'stripe' (Wave B) — null for now
  provider_token text,   -- vault token (Wave B) — null for now
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_customer_payment_methods_user
  on public.customer_payment_methods (user_id, created_at);
alter table public.customer_payment_methods enable row level security;
drop policy if exists "customer_payment_methods_self" on public.customer_payment_methods;
create policy "customer_payment_methods_self" on public.customer_payment_methods
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Link orders to the signed-in shopper (nullable: guest checkout still ok) ─
alter table public.orders
  add column if not exists customer_user_id uuid references auth.users(id) on delete set null;
create index if not exists idx_orders_customer_user
  on public.orders (customer_user_id, created_at);

-- Customers can read their OWN orders (owner full-access policy stays in place).
drop policy if exists "orders_customer_select" on public.orders;
create policy "orders_customer_select" on public.orders
  for select using (customer_user_id = auth.uid());

drop policy if exists "order_items_customer_select" on public.order_items;
create policy "order_items_customer_select" on public.order_items
  for select using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.customer_user_id = auth.uid()
  ));
