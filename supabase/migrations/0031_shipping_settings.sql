-- ============================================================================
--  Migration 0031 — store shipping settings on the business. Applied via MCP.
--  shipping_fee: flat delivery fee (null/0 = none).
--  free_shipping_threshold: order total at/above which shipping is free (null = never).
-- ============================================================================

alter table public.businesses
  add column if not exists shipping_fee numeric,
  add column if not exists free_shipping_threshold numeric;
