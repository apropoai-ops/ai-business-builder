import type { PlanTier } from "@/types/database";
// Type-only: keeps lib/plans.ts free of any runtime dependency on the mode
// registry, so neither file can ever import the other into a cycle.
import type { SiteMode } from "@/lib/site-mode";

/**
 * Machine-readable feature keys gated per plan tier. These back the actual
 * enforcement (server actions / pages) — the `features` string list on each
 * PlanDef is only the human-readable marketing copy shown on /pricing and is
 * NOT read by any guard. See lib/entitlements.ts for the FEATURES registry,
 * planAllows(), and the upsell helper built on top of this list.
 */
export type FeatureKey =
  | "publish_site" // publish to a public URL (already covered by canPublish, kept here too for uniform gating)
  | "store_basic" // basic store: products, no card payments/coupons/shipping/bookings
  | "store_full" // full store: card payments, coupons, shipping methods/warehouses
  | "bookings" // appointment calendar (יומן תורים)
  | "content_engine" // AI content generator (מנוע תוכן)
  | "content_calendar" // scheduled content calendar (לוח תוכן)
  | "social_media" // social media assistant
  | "quotes" // quotes (הצעות מחיר)
  | "all_modules" // unlock all 20 website modules (vs. a curated subset)
  | "whatsapp_agent" // AI WhatsApp agent
  | "ai_insights" // AI insights / forecasts / restock recommendations
  | "business_score" // business score (0-100)
  | "hr" // recruiting / HR module
  | "rentals" // תזמון לילות (hospitality date reservations)
  | "ads" // paid ads generator
  | "priority_support"; // priority support (informational — not enforced in-app)

/**
 * Plan definitions — the single source of truth for limits and pricing.
 * Limits are monthly, summed across all of a user's businesses.
 * Infinity = unlimited. Prices in ILS (adjustable before launch).
 */
export type PlanDef = {
  tier: PlanTier;
  name: string;
  /**
   * ILS per month, **including VAT** — this is the sticker price, the number
   * the customer is charged, and the amount the Stripe Price must be created
   * for. Israeli consumer pricing is quoted gross, and charm prices only work
   * if the number on the card is the number on the invoice. Use
   * `priceBeforeVat()` for anything that needs the net figure (accounting,
   * margin math).
   */
  priceMonthly: number;
  /**
   * Which of the three build modes (lib/site-mode.ts) this plan may PUBLISH.
   * This is the axis the packages are sold on: a landing page, a brochure site
   * or a full store. Progressive — every tier includes the modes below it,
   * because a store owner running a campaign genuinely needs a landing page
   * and the top package must never be less capable than a cheaper one.
   *
   * `free` lists all three on purpose: it's a build-only trial that can't
   * publish at all, so letting someone try the store builder is what earns the
   * upgrade rather than something to withhold.
   */
  siteModes: SiteMode[];
  businesses: number;
  aiGenerations: number;
  chatMessages: number;
  /** Hard ceiling on estimated AI spend per business per month, in USD. A
   *  safety net above the normal generation quota — catches runaway/abusive
   *  usage without choking a paying customer's expected allowance. */
  monthlyCostCapUsd: number;
  canPublish: boolean;
  /** Auto-generated daily AI CEO brief via cron — a PRO+ feature (cost gate). */
  dailyBrief: boolean;
  highlight?: boolean;
  features: string[];
  /** Machine-readable capability set for this tier — used by lib/entitlements.ts
   *  to hard-block premium features server-side. Progressive: each tier's set
   *  is a superset of the tier below it. */
  entitlements: FeatureKey[];
};

export const PLANS: Record<PlanTier, PlanDef> = {
  free: {
    tier: "free",
    name: "חינם",
    priceMonthly: 0,
    // Build-only trial: any mode may be BUILT, none may be published.
    siteModes: ["landing", "website", "store"],
    businesses: 1,
    aiGenerations: 10,
    chatMessages: 50,
    monthlyCostCapUsd: 5,
    canPublish: false,
    dailyBrief: false,
    features: [
      "בניית עסק אחד מקצה לקצה",
      "תוכנית עסקית, מחקר שוק ומיתוג AI",
      "10 יצירות AI בחודש",
      "CRM בסיסי",
      "פרסום האתר דורש חבילה בתשלום",
    ],
    // free: business plan/research/branding + basic CRM only — no publish.
    entitlements: [],
  },
  starter: {
    tier: "starter",
    name: "דף נחיתה",
    priceMonthly: 199,
    siteModes: ["landing"],
    businesses: 1,
    aiGenerations: 60,
    chatMessages: 300,
    monthlyCostCapUsd: 12,
    canPublish: true,
    dailyBrief: false,
    features: [
      "דף נחיתה אחד ממוקד המרה",
      "טיימר, וידאו, גלריה וטופס לידים",
      "טופס לידים שנכנס ישירות ל-CRM",
      "מחולל פרסום ממומן",
      "CRM לידים + אוטומציות",
    ],
    // Landing tier: publish + the ads generator. Whoever buys a landing page is
    // by definition running paid campaigns, so hiding the ad copy generator
    // behind the top tier would be backwards.
    entitlements: ["publish_site", "ads"],
  },
  pro: {
    tier: "pro",
    name: "אתר תדמית",
    priceMonthly: 349,
    siteModes: ["landing", "website"],
    businesses: 1,
    aiGenerations: 200,
    chatMessages: 1200,
    monthlyCostCapUsd: 30,
    canPublish: true,
    dailyBrief: false,
    highlight: true,
    features: [
      "כל מה שבדף נחיתה, ובנוסף:",
      "אתר תדמית מלא — בית, אודות, שירותים, בלוג",
      "יומן תורים + הצעות מחיר",
      "מחולל תוכן, לוח תוכן ורשתות חברתיות",
      "תזמון לילות לצימרים ואירוח",
    ],
    // Website tier: the service-business toolkit. `rentals` lives here rather
    // than at the top because a צימר is a service business, not a store.
    entitlements: [
      "publish_site",
      "ads",
      "bookings",
      "content_engine",
      "content_calendar",
      "social_media",
      "quotes",
      "rentals",
    ],
  },
  business: {
    tier: "business",
    name: "חנות",
    priceMonthly: 699,
    siteModes: ["landing", "website", "store"],
    businesses: 1,
    aiGenerations: 600,
    chatMessages: 4000,
    monthlyCostCapUsd: 60,
    canPublish: true,
    dailyBrief: true,
    features: [
      "כל מה שבאתר תדמית, ובנוסף:",
      "חנות מלאה — מוצרים, עגלה וסליקת אשראי",
      "קופונים, משלוחים, הזמנות וחשבוניות",
      "סוכן וואטסאפ AI + כל המודולים לאתר",
      "תובנות AI, ציון עסקי, גיוס ותמיכה מועדפת",
    ],
    // Store tier: commerce + everything premium.
    entitlements: [
      "publish_site",
      "ads",
      "bookings",
      "content_engine",
      "content_calendar",
      "social_media",
      "quotes",
      "rentals",
      "store_basic",
      "store_full",
      "all_modules",
      "whatsapp_agent",
      "ai_insights",
      "business_score",
      "hr",
      "priority_support",
    ],
  },
};

/** Optional paid add-ons a customer can attach to any package. */
export type AddonDef = {
  key: string;
  label: string;
  /** ILS per month, including VAT — same convention as PlanDef.priceMonthly. */
  priceMonthly: number;
  description: string;
};

export const ADDONS: AddonDef[] = [
  { key: "extra_business", label: "עסק נוסף", priceMonthly: 199, description: "ניהול עסק נוסף באותו חשבון" },
  { key: "ai_boost", label: "מכסת AI מוכפלת", priceMonthly: 149, description: "פי 2 יצירות AI בחודש" },
  { key: "whatsapp_agent", label: "סוכן וואטסאפ", priceMonthly: 199, description: "סוכן AI לוואטסאפ (כלול בחבילת חנות)" },
  { key: "custom_domain", label: "דומיין מותאם אישית", priceMonthly: 49, description: "כתובת אתר משלכם" },
  { key: "remove_branding", label: 'הסרת מיתוג "נבנה ב-"', priceMonthly: 99, description: "אתר נקי לגמרי מהמיתוג שלנו" },
  { key: "rentals", label: "תזמון לילות (אירוח)", priceMonthly: 149, description: "שריון תאריכים לצימרים (כלול מחבילת אתר תדמית)" },
];

/** Israeli VAT, as of 2026. Every price in this file is quoted INCLUDING it. */
export const VAT_RATE = 0.18;

/** The net (pre-VAT) figure behind a gross price — for accounting and margins. */
export function priceBeforeVat(grossIls: number): number {
  return Math.round(grossIls / (1 + VAT_RATE));
}

export const PLAN_ORDER: PlanTier[] = ["free", "starter", "pro", "business"];

/** The three paid packages shown on the public "חבילות" page (free is the signup default). */
export const PACKAGE_ORDER: Exclude<PlanTier, "free">[] = ["starter", "pro", "business"];

export function formatLimit(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString("he-IL") : "ללא הגבלה";
}
