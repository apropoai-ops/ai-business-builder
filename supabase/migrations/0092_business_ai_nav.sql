-- 0092: AI-picked dashboard relevance.
-- "לוח לילות" (nav key `rentals`) was gated purely by plan entitlement
-- (lib/entitlements.ts), with no check against what the business actually
-- sells — a retail store on a Pro+ plan saw it exactly like a צימר did.
-- hidden_nav_keys is a negative list (allow-by-default, same philosophy as
-- SITE_MODE_DEFS.hiddenNav): an AI classifier fills it in per business for a
-- small set of vertical-specific nav keys (rentals/bookings/hr/quotes/projects),
-- and lib/dashboard-departments.ts subtracts it from whatever the plan/mode
-- already allow. Empty/unclassified = show everything, so nothing regresses
-- before classification runs.
alter table public.businesses
  add column if not exists hidden_nav_keys text[] not null default '{}',
  add column if not exists ai_nav_classified_at timestamptz;
