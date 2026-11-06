-- 0058: engraved/personalized products (dropshipping-ready) — per-product
-- engraving config, per-line engraving text on orders, and a supplier-ordered
-- marker so dropshippers can track which paid orders were sent to the supplier.

-- Per-product personalization config:
-- { enabled: boolean, label?: string, maxChars?: number, required?: boolean }
alter table public.products
  add column if not exists engraving jsonb;

-- The exact text the customer asked to engrave, per order line.
alter table public.order_items
  add column if not exists engraving text;

-- Dropship workflow: when the owner forwarded this order to their supplier.
alter table public.orders
  add column if not exists supplier_ordered_at timestamptz;
