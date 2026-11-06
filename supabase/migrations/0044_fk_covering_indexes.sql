-- ============================================================================
--  Migration 0044 — QA polish: covering indexes for foreign keys flagged by the
--  Supabase performance advisor (unindexed_foreign_keys). All INFO-level but
--  cheap to fix. Applied via MCP.
-- ============================================================================

create index if not exists idx_abandoned_carts_user on public.abandoned_carts (customer_user_id);
create index if not exists idx_loyalty_points_user on public.loyalty_points (customer_user_id);
create index if not exists idx_order_items_product on public.order_items (product_id);
create index if not exists idx_order_items_variant on public.order_items (variant_id);
create index if not exists idx_referrals_referred_user on public.referrals (referred_user_id);
create index if not exists idx_returns_order on public.returns (order_id);
