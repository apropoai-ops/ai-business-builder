import { PLANS, PLAN_ORDER, type FeatureKey, type PlanDef } from "@/lib/plans";
import { siteModeDef, type SiteMode } from "@/lib/site-mode";
import type { PlanTier } from "@/types/database";

/**
 * Feature entitlement enforcement — which capabilities each plan tier
 * unlocks. This is a companion to lib/quota.ts: quota.ts gates AI generation
 * *counts* and the cost cap; this file gates *capabilities* (does this plan
 * include full store payments, the WhatsApp agent, HR, etc. at all).
 *
 * FEATURES is the single source of truth for the Hebrew label + the minimum
 * tier that unlocks each feature, used both for guards (planAllows) and for
 * the upsell copy ("התכונה הזו זמינה בחבילה X ומעלה").
 */

export const FEATURES: Record<FeatureKey, { label: string; minTier: PlanTier }> = {
  publish_site: { label: "פרסום אתר לכתובת ציבורית", minTier: "starter" },
  ads: { label: "מחולל פרסום ממומן", minTier: "starter" },
  bookings: { label: "יומן תורים", minTier: "pro" },
  content_engine: { label: "מחולל תוכן שיווקי", minTier: "pro" },
  content_calendar: { label: "לוח תוכן מתוזמן", minTier: "pro" },
  social_media: { label: "עוזר רשתות חברתיות", minTier: "pro" },
  quotes: { label: "הצעות מחיר", minTier: "pro" },
  rentals: { label: "תזמון לילות (אירוח)", minTier: "pro" },
  store_basic: { label: "חנות בסיסית (מוצרים)", minTier: "business" },
  store_full: { label: "חנות מלאה — סליקת אשראי, קופונים ומשלוחים", minTier: "business" },
  all_modules: { label: "כל המודולים לאתר", minTier: "business" },
  whatsapp_agent: { label: "סוכן וואטסאפ חכם", minTier: "business" },
  ai_insights: { label: "תובנות AI ותחזיות עסקיות", minTier: "business" },
  business_score: { label: "ציון עסקי", minTier: "business" },
  hr: { label: "גיוס ומשאבי אנוש", minTier: "business" },
  priority_support: { label: "תמיכה מועדפת", minTier: "business" },
};

/**
 * Maps a paid add-on key (lib/plans.ts ADDONS) to the feature it grants when
 * active, independent of plan tier. Only add-ons with a hard-enforced
 * feature gate are listed here — custom_domain/remove_branding are
 * cosmetic-only and not enforced anywhere, ai_boost/extra_business affect
 * quota (lib/quota.ts applyAddonsToPlan) rather than a FeatureKey.
 */
const ADDON_GRANTS_FEATURE: Partial<Record<string, FeatureKey>> = {
  whatsapp_agent: "whatsapp_agent",
  rentals: "rentals",
};

/**
 * Does this plan include the given feature? Optionally also true when one
 * of the user's active add-ons (a Set of addon_key strings, e.g. from
 * lib/services/addons.service.ts getActiveAddons) grants it — this is an
 * additive optional param so every existing call site (which passes only
 * plan + key) keeps compiling and behaving exactly as before.
 */
export function planAllows(
  plan: PlanDef | PlanTier,
  key: FeatureKey,
  activeAddons?: Set<string>,
): boolean {
  const def = typeof plan === "string" ? PLANS[plan] : plan;
  if (def.entitlements.includes(key)) return true;
  if (activeAddons) {
    for (const addonKey of activeAddons) {
      if (ADDON_GRANTS_FEATURE[addonKey] === key) return true;
    }
  }
  return false;
}

/** The minimum plan tier that unlocks this feature (for upsell copy/links). */
export function minTierFor(key: FeatureKey): PlanTier {
  return FEATURES[key].minTier;
}

/** The minimum plan def that unlocks this feature. */
export function minPlanFor(key: FeatureKey): PlanDef {
  return PLANS[minTierFor(key)];
}

/** Human label for a feature, e.g. for error messages and upgrade cards. */
export function featureLabel(key: FeatureKey): string {
  return FEATURES[key].label;
}

/**
 * A ready-made Hebrew error message for server-side hard blocks:
 * "<feature> זמין מתוכנית <tier> ומעלה. ..."
 */
export function upgradeMessage(key: FeatureKey): string {
  const plan = minPlanFor(key);
  return `${featureLabel(key)} זמין מתוכנית ${plan.name} ומעלה. ניתן לשדרג את התוכנית בעמוד התמחור.`;
}

export class FeatureNotAllowedError extends Error {
  key: FeatureKey;
  constructor(key: FeatureKey) {
    super(upgradeMessage(key));
    this.name = "FeatureNotAllowedError";
    this.key = key;
  }
}

/**
 * Throws FeatureNotAllowedError when the plan (and, if provided, the user's
 * active add-ons) lacks the feature. Use at the top of server actions that
 * perform a gated mutation, e.g.:
 *
 *   const plan = await getPlanForBusiness(businessId);
 *   assertFeature(plan, "hr");
 *
 * Or, to also honor a purchased add-on (e.g. whatsapp_agent/rentals bought
 * standalone on a lower tier):
 *
 *   const addons = await getActiveAddons(userId);
 *   assertFeature(plan, "whatsapp_agent", addons);
 */
export function assertFeature(plan: PlanDef, key: FeatureKey, activeAddons?: Set<string>): void {
  if (!planAllows(plan, key, activeAddons)) throw new FeatureNotAllowedError(key);
}

/** True if `a` is the same tier or higher than `b` (by PLAN_ORDER position). */
export function tierAtLeast(a: PlanTier, b: PlanTier): boolean {
  return PLAN_ORDER.indexOf(a) >= PLAN_ORDER.indexOf(b);
}

/**
 * Max number of the 20 website modules (lib/modules.ts) a plan without the
 * "all_modules" entitlement may enable at once — a curated subset rather
 * than the full catalog. The store tier has no cap (Infinity).
 */
export const CURATED_MODULE_LIMIT = 8;

/** Max simultaneously-enabled website modules for this plan. */
export function moduleLimitFor(plan: PlanDef): number {
  return planAllows(plan, "all_modules") ? Infinity : CURATED_MODULE_LIMIT;
}

// ── Site mode (which of the three products the plan sells) ──────────────────
//
// The packages are sold ON the build mode: דף נחיתה / אתר תדמית / חנות. This
// is the gate for that, and it is deliberately separate from FeatureKey — a
// mode isn't a feature you switch on, it's what the customer bought.

/** May this plan build & publish a site in this mode? */
export function planAllowsSiteMode(plan: PlanDef | PlanTier, mode: SiteMode): boolean {
  const def = typeof plan === "string" ? PLANS[plan] : plan;
  return def.siteModes.includes(mode);
}

/**
 * The mode a package IS, as opposed to every mode it *may* build.
 *
 * `siteModes` is a permission list — the store plan can also build a landing
 * page — but a customer who paid ₪699 for חנות bought a store, so that is what
 * we build them. Taking the last entry means the ladder stays correct if the
 * plans are ever re-ordered: each tier's list ends with the mode it is sold as.
 */
export function siteModeForPlan(plan: PlanDef | PlanTier): SiteMode {
  const def = typeof plan === "string" ? PLANS[plan] : plan;
  return def.siteModes[def.siteModes.length - 1] ?? "website";
}

/** How much site each mode is, cheapest first. Only used to compare upgrades. */
const MODE_RANK: Record<SiteMode, number> = { landing: 0, website: 1, store: 2 };

export function siteModeRank(mode: SiteMode): number {
  return MODE_RANK[mode];
}

/**
 * The cheapest tier that sells this mode. Scans PLAN_ORDER so it stays correct
 * automatically if the ladder is ever re-priced or re-ordered. `free` is
 * skipped: it can build every mode but publish none, so pointing an upgrade
 * prompt at it would be a dead end.
 */
export function minTierForSiteMode(mode: SiteMode): PlanTier {
  const tier = PLAN_ORDER.find(
    (t) => t !== "free" && PLANS[t].siteModes.includes(mode),
  );
  // Every mode is sold by at least one paid tier (pinned by tests/plans.test.ts).
  return tier ?? "business";
}

/** The cheapest plan that sells this mode — for upsell copy and links. */
export function minPlanForSiteMode(mode: SiteMode): PlanDef {
  return PLANS[minTierForSiteMode(mode)];
}

/** Hebrew upsell line for a mode the current plan doesn't include. */
export function siteModeUpgradeMessage(mode: SiteMode): string {
  const plan = minPlanForSiteMode(mode);
  return `${siteModeDef(mode).label} זמין בחבילת ${plan.name} (₪${plan.priceMonthly} לחודש). ניתן לשדרג בעמוד החבילות.`;
}
