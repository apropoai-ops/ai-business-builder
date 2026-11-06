-- ============================================================================
--  Migration 0034 — richer product fields + basic inventory. Applied via MCP.
--  sku/brand/subcategory/full_description; stock_qty + low_stock_threshold;
--  status active|draft|hidden (kept in sync with `active` for public queries).
-- ============================================================================

alter table public.products
  add column if not exists sku text,
  add column if not exists brand text,
  add column if not exists subcategory text,
  add column if not exists full_description text,
  add column if not exists stock_qty int,
  add column if not exists low_stock_threshold int,
  add column if not exists status text not null default 'active'
    check (status in ('active','draft','hidden'));

update public.products set status = 'hidden' where active = false;
