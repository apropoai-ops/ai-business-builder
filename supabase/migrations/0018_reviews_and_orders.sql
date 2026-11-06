-- ============================================================================
--  Migration 0018 — wave-2 foundation (applied via MCP).
--  reviews: public customer reviews with owner moderation (approved flag).
--  orders: store orders from the public site with status workflow.
--  Public inserts go through service-role server actions; owners get full RLS.
-- ============================================================================

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_name text not null,
  rating int not null check (rating between 1 and 5),
  content text not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_reviews_business on public.reviews (business_id, approved, created_at);
alter table public.reviews enable row level security;
create policy "reviews_owner_all" on public.reviews
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity int not null default 1 check (quantity between 1 and 99),
  customer_name text not null,
  customer_phone text not null,
  notes text,
  status text not null default 'new' check (status in ('new','confirmed','done','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists idx_orders_business on public.orders (business_id, status, created_at);
alter table public.orders enable row level security;
create policy "orders_owner_all" on public.orders
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));
