-- 0071: design tiers — every generated storefront renders in one of three
-- visual "leagues" (standard / advanced / professional), auto-assigned from
-- the owner's plan (free/starter -> standard, pro -> advanced,
-- business -> professional). The owner may opt into a LOWER tier than their
-- plan allows (e.g. keep the simpler "standard" look on a pro plan); a null
-- value means "automatic — follow the plan" and is resolved in application
-- code (lib/design-tier.ts resolveDesignTier), which also clamps any stored
-- value up/down to the current plan's ceiling so a downgraded plan can never
-- keep a tier above its max.
alter table public.businesses
  add column if not exists design_tier text
  check (design_tier is null or design_tier in ('standard', 'advanced', 'professional'));
