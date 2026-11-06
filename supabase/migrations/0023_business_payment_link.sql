-- 0023 business payment link
-- A free, provider-agnostic payment link the owner pastes (Stripe Payment Link,
-- PayPal.me, Bit, PayBox, etc.). Surfaced as a "pay now" button on accepted
-- quotes and the store. No API keys, no webhooks.
alter table public.businesses add column if not exists payment_link text;
