-- 0090: Catalog-only stores — a shop window with the checkout switched off.
-- Products, prices and product pages still render; the cart, the add-to-cart
-- button and every order-creating path are gone. Built for the public demo
-- store on the marketing site (GRAVÉ), where a visitor browsing an example
-- must never be able to place a real order, and equally for a real business
-- that shows a catalogue but sells by phone/showroom.
--
-- Deliberately NOT trigger-guarded the way 0085 guards site_mode: that guard
-- exists because site_mode is what the customer PAID for. This flag only ever
-- turns the owner's OWN sales off, defaults to false, and unlocks nothing —
-- so the table-level grant letting an owner write their own row is fine here.

alter table public.businesses
  add column if not exists catalog_only boolean not null default false;

comment on column public.businesses.catalog_only is
  'Store mode with checkout disabled: products and prices still render, but nothing can be bought. Enforced server-side in createPublicOrder / createPublicCartOrder / createPendingRentalBooking, never only in the UI.';
