-- ============================================================================
--  Migration 0029 — shopping cart: multi-item orders. Applied via MCP.
--  orders gains total + customer_address (header); order_items holds line items.
--  Single-product orders still work (they just have no order_items rows).
-- ============================================================================

alter table public.orders
  add column if not exists total numeric,
  add column if not exists customer_address text;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  variant text,
  quantity int not null default 1 check (quantity between 1 and 99),
  unit_price numeric,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_items_order on public.order_items (order_id);
create index if not exists idx_order_items_business on public.order_items (business_id);

alter table public.order_items enable row level security;
create policy "order_items_owner_all" on public.order_items
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
