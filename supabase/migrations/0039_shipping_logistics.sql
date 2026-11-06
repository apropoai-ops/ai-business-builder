-- ============================================================================
--  Migration 0039 — Wave C (part 2): shipping methods, warehouses, tracking.
--  shipping_methods: per-business selectable methods at checkout (delivery /
--  express / pickup / pickup_point / by_region). details jsonb holds regions
--  ([{name,price}]) or pickup points ([{name,address}]). orders capture the
--  chosen method + price + a tracking number. warehouses: simple owner list
--  (pickup locations / organization). Legacy flat shipping_fee still applies
--  when a business has no shipping_methods. Applied via MCP.
-- ============================================================================

create table if not exists public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  type text not null default 'delivery'
    check (type in ('delivery','express','pickup','pickup_point','by_region')),
  price numeric not null default 0,
  eta text,
  free_over numeric,
  details jsonb,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_shipping_methods_business on public.shipping_methods (business_id, sort);
alter table public.shipping_methods enable row level security;
drop policy if exists "shipping_methods_owner_all" on public.shipping_methods;
create policy "shipping_methods_owner_all" on public.shipping_methods
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  address text,
  phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_warehouses_business on public.warehouses (business_id, created_at);
alter table public.warehouses enable row level security;
drop policy if exists "warehouses_owner_all" on public.warehouses;
create policy "warehouses_owner_all" on public.warehouses
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));

alter table public.orders
  add column if not exists shipping_method text,
  add column if not exists shipping_price numeric,
  add column if not exists shipping_details text,
  add column if not exists tracking_number text,
  add column if not exists tracking_carrier text;
