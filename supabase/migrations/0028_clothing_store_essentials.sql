-- ============================================================================
--  Migration 0028 — clothing-store essentials (fashion). Applied via MCP.
--  products: category, optional sale_price (when set & < price → discounted),
--  images gallery (string[]), sizes (string[]), colors ([{name,hex}]), in_stock.
--  orders: variant text (chosen size/color summary). RLS inherited (no new tables).
-- ============================================================================

alter table public.products
  add column if not exists category text,
  add column if not exists sale_price numeric,
  add column if not exists images jsonb,
  add column if not exists sizes jsonb,
  add column if not exists colors jsonb,
  add column if not exists in_stock boolean not null default true;

alter table public.orders
  add column if not exists variant text;

create index if not exists idx_products_business_category
  on public.products (business_id, category);
