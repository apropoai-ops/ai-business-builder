/**
 * Site build modes — the single switch that turns this platform into three
 * products without becoming three codebases.
 *
 *   'website' · אתר תדמית — service businesses. Pages, content, SEO, blog,
 *               lead forms. Credibility and inquiries, NOT online selling.
 *   'landing' · דף נחיתה  — ONE conversion page for a campaign. Fixed section
 *               order, countdown timer, lead capture. No other pages.
 *   'store'   · חנות מלאה — everything in 'website' PLUS the full commerce
 *               stack (products, cart, checkout, orders, shipping, coupons,
 *               customer accounts).
 *
 * The mode lives on `businesses.site_mode` (migration 0077) and decides four
 * things, each consumed by a different layer:
 *   1. which AI agent + schema generates the site      → lib/jobs/handlers/website.ts
 *   2. which storefront modules/sections may render     → app/s/[slug]/page.tsx
 *   3. which dashboard nav items are visible            → components/shared/business-nav.tsx
 *   4. which public sub-routes exist at all             → app/s/[slug]/&ast;&ast;
 *
 * Pure & dependency-free (only the module-key registry) so it can be imported
 * from server components, server actions, the public site, AND unit tests —
 * same contract as lib/business-type.ts and lib/modules.ts.
 */

import { MODULE_KEYS, type ModuleKey } from "./modules";

export type SiteMode = "website" | "landing" | "store";

export const SITE_MODES: SiteMode[] = ["website", "landing", "store"];

const MODE_SET = new Set<string>(SITE_MODES);

/** Dashboard nav keys (mirrors the `key` field of ITEMS in business-nav.tsx). */
export type BusinessNavKey =
  | "overview"
  | "analytics"
  | "reports"
  | "score"
  | "plan"
  | "research"
  | "website"
  | "sections"
  | "crm"
  | "automations"
  | "ceo-chat"
  | "content"
  | "calendar"
  | "social"
  | "ads"
  | "whatsapp"
  | "store"
  /** "הוספת מוצר" — split out of the חנות screen so adding products has its
   *  own dedicated space instead of sharing it with catalog management and
   *  the operational settings. Same mode-gating as "store" (see hiddenNav
   *  below); deliberately NOT wired into `modeAllowsStoreScreen`'s nights
   *  exception — a rentals-only business has nothing to add here. */
  | "new-product"
  /**
   * "לוח לילות". Deliberately absent from every mode's `hiddenNav`: nights are
   * gated by the `rentals` ENTITLEMENT, not by the build mode — a צימר on the
   * brochure package sells nothing else and still needs this screen. Same
   * lesson `modeAllowsStoreScreen` was written for.
   */
  | "rentals"
  | "orders"
  | "returns"
  | "quotes"
  | "reviews"
  | "newsletter"
  | "bookings"
  | "projects"
  | "hr"
  | "members"
  | "integrations"
  | "export";

/** Public sub-routes under /s/[slug] that a mode may or may not expose. */
export type PublicRouteKey =
  | "product"
  | "account"
  | "blog"
  | "terms"
  | "help"
  | "accessibility";

export interface SiteModeDef {
  key: SiteMode;
  /** Hebrew label shown in the wizard picker and the dashboard. */
  label: string;
  /** One-line Hebrew pitch — what this mode is FOR. */
  tagline: string;
  /** Hebrew examples of who picks it, shown under the picker card. */
  audience: string;
  /** lucide-react icon name (resolved in the client picker). */
  icon: string;
  /** Nav items hidden in this mode (allow-by-default keeps new pages visible). */
  hiddenNav: BusinessNavKey[];
  /** Storefront modules this mode may use. Empty = the mode has no modules. */
  modules: ModuleKey[];
  /** Public sub-routes this mode serves; everything else 404s. */
  routes: PublicRouteKey[];
}

/**
 * Store-only modules: the two self-service commerce forms. `contact` stays
 * available everywhere — every mode captures leads.
 */
const STORE_ONLY_MODULES: ModuleKey[] = ["returns", "order_tracking"];

export const SITE_MODE_DEFS: Record<SiteMode, SiteModeDef> = {
  website: {
    key: "website",
    label: "אתר תדמית",
    tagline: "להציג את העסק, לבנות אמינות ולקבל פניות",
    audience: "עורכי דין, רואי חשבון, קוסמטיקאיות, אינסטלטורים, חשמלאים, מאמנים",
    icon: "Building2",
    // No selling → no products screen, no orders, no returns desk.
    hiddenNav: ["store", "new-product", "orders", "returns"],
    modules: MODULE_KEYS.filter((k) => !STORE_ONLY_MODULES.includes(k)),
    // No product pages; /account still serves booking customers ("התורים שלי").
    // /help is shipping-and-returns copy end to end ("ביטול עסקה תוך 14 ימים",
    // "אמצעי תשלום") — on a brochure site that sells nothing it reads as a
    // different business's page, so the mode doesn't serve it at all.
    routes: ["account", "blog", "terms", "accessibility"],
  },
  landing: {
    key: "landing",
    label: "דף נחיתה",
    tagline: "דף אחד שממיר — לקמפיין, למוצר או להשקה",
    audience: "קמפיינים בפייסבוק וגוגל, מוצר בודד, קורס, וובינר, השקת שירות",
    icon: "Target",
    // ONE page: no extra pages, no module picker, no commerce, no booking
    // calendar, no blog/content pipeline. What's left is the campaign toolkit:
    // the page, the brand, the leads and the ads.
    hiddenNav: [
      "reports",
      "score",
      "plan",
      "research",
      "sections",
      "content",
      "calendar",
      "social",
      "store",
      "new-product",
      "orders",
      "returns",
      "quotes",
      "newsletter",
      "bookings",
      "projects",
      "hr",
    ],
    // The landing page has a FIXED section order — modules would fight it.
    modules: [],
    // Only the page itself, plus the two pages Israeli law expects to exist.
    routes: ["terms", "accessibility"],
  },
  store: {
    key: "store",
    label: "חנות אונליין",
    tagline: "למכור מוצרים אונליין מקצה לקצה",
    audience: "אופנה, תכשיטים, רהיטים, קוסמטיקה, ציוד לבית, מוצרים דיגיטליים",
    icon: "ShoppingBag",
    hiddenNav: [],
    modules: MODULE_KEYS,
    routes: ["product", "account", "blog", "terms", "help", "accessibility"],
  },
};

export const SITE_MODE_LIST: SiteModeDef[] = SITE_MODES.map((m) => SITE_MODE_DEFS[m]);

export function isSiteMode(value: unknown): value is SiteMode {
  return typeof value === "string" && MODE_SET.has(value);
}

/**
 * Normalizes whatever is stored on the row into a valid mode. Unknown/null
 * falls back to 'website' — the mode that assumes the least (no commerce
 * surfaces, no fixed one-page layout).
 */
export function resolveSiteMode(value: unknown): SiteMode {
  return isSiteMode(value) ? value : "website";
}

export function siteModeDef(value: unknown): SiteModeDef {
  return SITE_MODE_DEFS[resolveSiteMode(value)];
}

/** Convenience predicates — read better than `mode === "store"` at call sites. */
export function isStoreMode(value: unknown): boolean {
  return resolveSiteMode(value) === "store";
}

export function isLandingMode(value: unknown): boolean {
  return resolveSiteMode(value) === "landing";
}

/** Does this mode sell products (cart, checkout, orders, wishlist)? */
export function modeHasCommerce(value: unknown): boolean {
  return isStoreMode(value);
}

/**
 * May a visitor actually BUY? A store can be put in `catalog_only` — a shop
 * window with the checkout switched off: the products, the prices and the
 * product pages all still render, but there is no cart and no order path.
 *
 * Two independent reasons to say no, which is why this is not folded into
 * `modeHasCommerce`: that one is about the *mode* (what the customer bought),
 * this adds the *business*'s own switch — same split as `modeAllowsStoreScreen`.
 * The public demo store on the marketing site runs this way, so a visitor
 * browsing an example can never place a real order.
 *
 * Every order-creating service re-checks this against the raw DB row. Hiding
 * the button is not enforcement — the checkout actions are public POSTs.
 */
export function sellsOnline(
  value: unknown,
  opts?: { catalogOnly?: boolean | null },
): boolean {
  return modeHasCommerce(value) && !opts?.catalogOnly;
}

/** Does this mode render the multi-section, module-driven storefront? */
export function modeHasModules(value: unknown): boolean {
  return siteModeDef(value).modules.length > 0;
}

export function modulesForMode(value: unknown): ModuleKey[] {
  return siteModeDef(value).modules;
}

export function modeAllowsModule(value: unknown, key: ModuleKey): boolean {
  return siteModeDef(value).modules.includes(key);
}

export function modeAllowsNav(value: unknown, key: BusinessNavKey): boolean {
  return !siteModeDef(value).hiddenNav.includes(key);
}

/**
 * May the "חנות" screen open? It is the one screen that lists everything the
 * business SELLS, and since "תזמון לילות" moved into it a night is just another
 * thing on the shelf — so the screen has two independent reasons to exist:
 *
 *   1. the mode sells products  → 'store' only, same as `modeAllowsNav`
 *   2. the business sells nights → any mode
 *
 * Reason 2 exists because a צימר buys the אתר תדמית package: brochure mode,
 * zero products, yet it very much sells something. Without this the booking
 * system it pays for would have nowhere to live. Deliberately NOT folded into
 * `hiddenNav` — that list is about the *mode*, and this is about the business.
 */
export function modeAllowsStoreScreen(
  value: unknown,
  opts?: { sellsNights?: boolean },
): boolean {
  return modeAllowsNav(value, "store") || Boolean(opts?.sellsNights);
}

export function modeAllowsRoute(value: unknown, key: PublicRouteKey): boolean {
  return siteModeDef(value).routes.includes(key);
}

/**
 * Best-guess mode for a business that never picked one — the same rule the
 * 0077 backfill applies, expressed in TypeScript so callers that already hold
 * the product count don't need a round trip. Anyone who created a product was
 * building a store; everyone else gets the brochure site.
 */
export function inferSiteMode(b: { productCount?: number | null }): SiteMode {
  return (b.productCount ?? 0) > 0 ? "store" : "website";
}
