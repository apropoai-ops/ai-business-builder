/**
 * Design tiers — the visual "league" a business's public storefront renders
 * in. Auto-assigned from the owner's plan (see lib/plans.ts PlanTier), with
 * an optional per-business override that is always CLAMPED to the plan's
 * ceiling (so a downgraded plan can never keep rendering a tier above what
 * it now allows, and an invalid/stale stored value never breaks the site).
 *
 * Pure & dependency-free — no server imports — so it can be imported from
 * server components, server actions, services, and client-side pickers.
 */

export type DesignTier = "standard" | "advanced" | "professional";

export const DESIGN_TIERS: DesignTier[] = ["standard", "advanced", "professional"];

export const DESIGN_TIER_LABELS: Record<DesignTier, string> = {
  standard: "סטנדרט",
  advanced: "מתקדם",
  professional: "מקצועי",
};

export const DESIGN_TIER_DESCRIPTIONS: Record<DesignTier, string> = {
  standard: "עיצוב מסחרי נקי ופונקציונלי — ברור, מהיר ומוכר לגולשים.",
  advanced: "עיצוב עורכי ומינימליסטי בהשראת סטודיואים מובילים — טיפוגרפיה, ריווח ותשומת לב לפרטים.",
  professional: "חוויה קולנועית וסוחפת עם אנימציות חיות — הרמה הגבוהה ביותר שהפלטפורמה מציעה.",
};

/** Ordinal rank used to compare/clamp tiers (higher = more "premium"). */
export function tierRank(t: DesignTier): number {
  return DESIGN_TIERS.indexOf(t);
}

/**
 * 2026-07-21 product decision: "professional" is the ONLY tier — every site,
 * on every plan, renders the top cinematic experience. The standard/advanced
 * CSS kits remain in the codebase but are no longer reachable; the plan
 * mapping and per-business override were retired with the picker UI.
 */
export function maxTierForPlan(plan: string): DesignTier {
  void plan; // signature kept for existing callers
  return "professional";
}

/** Every business renders the professional tier (see note above). */
export function resolveDesignTier(
  override: string | null | undefined,
  plan: string,
): DesignTier {
  void override; // signature kept for existing callers
  void plan;
  return "professional";
}
