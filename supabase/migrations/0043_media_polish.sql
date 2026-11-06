-- ============================================================================
--  Migration 0043 — Wave G (part 1): media + polish.
--  products.video_url: optional product video (YouTube/MP4 link shown on the
--  storefront). products.wholesale_price: wholesale/cost-side price for margin
--  reporting (alongside cost_price added in 0040). Applied via MCP.
-- ============================================================================

alter table public.products
  add column if not exists video_url text,
  add column if not exists wholesale_price numeric;
