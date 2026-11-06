-- ============================================================================
--  Migration 0038 — Wave C (part 1): per-variant inventory + pre-order + barcode.
--  product_variants holds stock per size/color combo (with optional SKU+barcode);
--  orders that reference a variant auto-decrement its stock. Products opt in via
--  track_inventory; preorder lets shoppers buy when stock is 0. Legacy products
--  (sizes/colors arrays, product-level in_stock) keep working unchanged.
--  Applied via MCP.
-- ============================================================================

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  size text,
  color text,
  sku text,
  barcode text,
  stock_qty int not null default 0,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_product_variants_product on public.product_variants (product_id, sort);
create index if not exists idx_product_variants_business on public.product_variants (business_id);
alter table public.product_variants enable row level security;
drop policy if exists "product_variants_owner_all" on public.product_variants;
create policy "product_variants_owner_all" on public.product_variants
  for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));

alter table public.products
  add column if not exists track_inventory boolean not null default false,
  add column if not exists preorder boolean not null default false,
  add column if not exists barcode text;

alter table public.order_items
  add column if not exists variant_id uuid references public.product_variants(id) on delete set null;
