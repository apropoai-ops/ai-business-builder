/**
 * Full-site STRUCTURAL layout registry — orthogonal to `hero_style` (which
 * only swaps the hero visual). `layout_style` controls which order the page
 * SECTIONS render in and a few structural hints (about split, condensed
 * container). Pure & dependency-free so it can be imported from
 * server components, server actions, and the owner-facing picker.
 *
 * IMPORTANT: 'flow' must always resolve to the EXACT section order the
 * storefront originally shipped with, so existing sites render pixel-identical.
 */

/** Section keys in the order they can appear on the public storefront. Hero,
 * header, floating buttons and footer are NOT part of this list — they always
 * render outside the ordered block. */
export type SiteSectionKey =
  | "benefits"
  | "about"
  | "services"
  | "store"
  | "booking"
  | "faq"
  | "orderTracking"
  | "rentals"
  | "modules"
  | "reviews"
  | "band"
  | "contact";

// "portal" (מגזין) was retired on 2026-07-30 at the owner's request. No site
// used it, and `resolveSiteLayout` falls back to 'flow' for any unknown stored
// value, so a stale row can't break a storefront.
export type SiteLayoutKey = "flow" | "showcase" | "story" | "compact" | "express";

export const LAYOUT_KEYS: SiteLayoutKey[] = ["flow", "showcase", "story", "compact", "express"];

/** Structural rendering hints a layout can request from the page. */
export interface SiteLayoutHints {
  /** Render the About section as a 2-column split (text + image) when a hero/about image exists. */
  aboutVariant: "default" | "split";
  /** Wrap "other enabled modules" (benefits/services/faq/etc, beyond the primary flow) in a condensed max-w-4xl column. */
  condensed: boolean;
}

export interface SiteLayoutDef {
  key: SiteLayoutKey;
  label: string;
  description: string;
  sections: SiteSectionKey[];
  hints: SiteLayoutHints;
}

const DEFAULT_HINTS: SiteLayoutHints = {
  aboutVariant: "default",
  condensed: false,
};

/**
 * Registry of the 5 built-in full-site layouts. `flow` is the default and
 * matches the original hard-coded JSX order in app/s/[slug]/page.tsx exactly.
 */
export const SITE_LAYOUTS: Record<SiteLayoutKey, SiteLayoutDef> = {
  flow: {
    key: "flow",
    label: "קלאסי",
    description: "מבנה האתר המוכר והמסודר — מהיר להבנה, מתאים לכל סוג עסק.",
    sections: [
      "benefits",
      "about",
      "services",
      "store",
      "booking",
      "faq",
      "orderTracking",
      "rentals",
      "modules",
      "reviews",
      "band",
      "contact",
    ],
    hints: DEFAULT_HINTS,
  },
  showcase: {
    key: "showcase",
    label: "חלון ראווה",
    description: "מוצרים בקדמת הבמה מיד אחרי הפתיחה — כמו חנות קונספט מקוונת.",
    sections: [
      "store",
      "benefits",
      "modules",
      "reviews",
      "band",
      "about",
      "services",
      "booking",
      "orderTracking",
      "rentals",
      "faq",
      "contact",
    ],
    hints: DEFAULT_HINTS,
  },
  story: {
    key: "story",
    label: "סיפור מותג",
    description: "פותח בסיפור ובערכים של העסק — בפיצול דו-טורי עם תמונה — ואז עובר למכירה.",
    sections: [
      "about",
      "benefits",
      "services",
      "store",
      "booking",
      "orderTracking",
      "rentals",
      "modules",
      "reviews",
      "band",
      "faq",
      "contact",
    ],
    hints: { ...DEFAULT_HINTS, aboutVariant: "split" },
  },
  compact: {
    key: "compact",
    label: "ממוקד המרה",
    description: "עמוד אחד קצר וממוקד עם קריאה-לפעולה בולטת — ליעד המרה מהיר.",
    sections: [
      "benefits",
      "services",
      "store",
      "booking",
      "faq",
      "orderTracking",
      "rentals",
      "modules",
      "reviews",
      "band",
      "contact",
    ],
    hints: { ...DEFAULT_HINTS, condensed: true },
  },
  express: {
    key: "express",
    label: "אקספרס — פעולה מיידית",
    description:
      "קביעת תור והזמנה כבר בפתיחת העמוד — מסלול הכי קצר להמרה, מושלם לעסקי תורים ושירותים",
    sections: [
      "booking",
      "services",
      "store",
      "benefits",
      "reviews",
      "faq",
      "about",
      "orderTracking",
      "rentals",
      "modules",
      "band",
      "contact",
    ],
    hints: { ...DEFAULT_HINTS, condensed: true },
  },
};

export const SITE_LAYOUT_LIST: SiteLayoutDef[] = LAYOUT_KEYS.map((k) => SITE_LAYOUTS[k]);

/** Resolves an arbitrary stored value into a known layout def, defaulting to 'flow'. */
export function resolveSiteLayout(value: unknown): SiteLayoutDef {
  if (typeof value === "string" && (LAYOUT_KEYS as string[]).includes(value)) {
    return SITE_LAYOUTS[value as SiteLayoutKey];
  }
  return SITE_LAYOUTS.flow;
}

export function isSiteLayoutKey(value: unknown): value is SiteLayoutKey {
  return typeof value === "string" && (LAYOUT_KEYS as string[]).includes(value);
}
