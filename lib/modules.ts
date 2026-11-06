/**
 * Canonical registry of the 20 universal opt-in storefront modules + the
 * per-business config helpers that drive the "בורר מודולים" (module picker).
 *
 * Pure & dependency-free (only types) so it can be imported from server
 * components, server actions, the public site, AND unit tests.
 *
 * A business stores `module_config` (jsonb) = a map keyed by module key:
 *   { [key]: { enabled: boolean, sort: number } }
 * Any key MISSING from the map defaults to enabled + its canonical order, so
 * existing businesses (empty map) behave exactly as before this feature.
 */

export type ModuleKey =
  | "testimonials"
  | "gallery"
  | "menu"
  | "pricing"
  | "team"
  | "events"
  | "blog"
  | "faqs"
  | "jobs"
  | "gift_cards"
  | "process_steps"
  | "stats"
  | "before_after"
  | "courses"
  | "memberships"
  | "downloads"
  | "donations"
  | "branches"
  | "certifications"
  | "partners"
  | "contact"
  | "returns"
  | "order_tracking";

export interface ModuleDef {
  key: ModuleKey;
  /** Hebrew label shown in the picker. */
  label: string;
  /** One-line Hebrew description of what the module shows on the site. */
  description: string;
  /** lucide-react icon name (resolved in the client picker). */
  icon: string;
}

/**
 * Canonical order = the order modules appear on the public storefront by
 * default (mirrors the original hard-coded JSX order in app/s/[slug]/page.tsx).
 */
export const MODULES: ModuleDef[] = [
  { key: "testimonials", label: "ממליצים", description: "ציטוטי לקוחות וסיפורי הצלחה", icon: "Quote" },
  { key: "gallery", label: "גלריה", description: "תמונות עבודות / מוצרים / אווירה", icon: "Image" },
  { key: "menu", label: "תפריט", description: "תפריט פריטים עם מחירים (מסעדות/בתי קפה)", icon: "UtensilsCrossed" },
  { key: "pricing", label: "מסלולי מחיר", description: "טבלת חבילות ומחירים", icon: "Package" },
  { key: "team", label: "צוות", description: "אנשי הצוות והתפקידים", icon: "Users" },
  { key: "events", label: "אירועים", description: "אירועים, סדנאות והרשמות", icon: "CalendarDays" },
  { key: "blog", label: "בלוג", description: "מאמרים ותכנים", icon: "Newspaper" },
  { key: "faqs", label: "שאלות נפוצות", description: "שאלות ותשובות נפוצות", icon: "HelpCircle" },
  { key: "jobs", label: "דרושים", description: "משרות פתוחות וגיוס", icon: "Briefcase" },
  { key: "gift_cards", label: "גיפט קארד", description: "שוברי מתנה לרכישה", icon: "Gift" },
  { key: "process_steps", label: "תהליך עבודה", description: "שלבי התהליך / איך זה עובד", icon: "ListOrdered" },
  { key: "stats", label: "נתונים ומספרים", description: "מספרים מרשימים (לקוחות, פרויקטים…)", icon: "BarChart3" },
  { key: "before_after", label: "לפני ואחרי", description: "תמונות לפני/אחרי", icon: "Images" },
  { key: "courses", label: "קורסים", description: "קורסים והכשרות", icon: "GraduationCap" },
  { key: "memberships", label: "מנויים", description: "מסלולי מנוי / חברות", icon: "BadgeCheck" },
  { key: "downloads", label: "הורדות", description: "קבצים להורדה (מדריכים, קטלוגים…)", icon: "FileDown" },
  { key: "donations", label: "תרומות", description: "קריאה לתרומה / התרמה", icon: "HeartHandshake" },
  { key: "branches", label: "סניפים", description: "מיקומי סניפים וכתובות", icon: "MapPin" },
  { key: "certifications", label: "הסמכות", description: "תעודות והסמכות מקצועיות", icon: "Award" },
  { key: "partners", label: "שותפים", description: "לוגואים של שותפים ולקוחות", icon: "Handshake" },
  // Core closing section — unlike the content modules above it renders even
  // without owner-added content, so the picker toggle is its only off switch.
  { key: "contact", label: "צור קשר וטופס לידים", description: "טופס השארת פרטים בתחתית האתר (לידים ל-CRM)", icon: "Send" },
  // Storefront-only self-service returns/exchanges form (shows next to order
  // tracking when the store has products). Toggle-only, like "contact".
  { key: "returns", label: "החזרות והחלפות", description: "טופס בקשת החזרה/החלפה ללקוחות בחנות", icon: "RotateCcw" },
  // Self-service "איפה ההזמנה שלי" lookup (order number + phone) shown in the
  // store when there are products. Toggle-only, like "contact"/"returns".
  { key: "order_tracking", label: "מעקב הזמנות", description: "טופס מעקב הזמנה עצמאי ללקוחות בחנות (מספר הזמנה + טלפון)", icon: "PackageSearch" },
];

export const MODULE_KEYS: ModuleKey[] = MODULES.map((m) => m.key);

/**
 * "Core toggle" modules: pure on/off switches for built-in storefront forms
 * (closing lead form, returns form, order lookup). Unlike content modules they
 * have no owner-added content, always render when enabled, must never be
 * auto-disabled by the AI picker, and don't count against a plan's curated
 * module cap.
 */
export const CORE_TOGGLE_KEYS: ModuleKey[] = ["contact", "returns", "order_tracking"];

const CORE_TOGGLE_SET = new Set<ModuleKey>(CORE_TOGGLE_KEYS);

export function isCoreToggle(key: ModuleKey): boolean {
  return CORE_TOGGLE_SET.has(key);
}

const KEY_SET = new Set<string>(MODULE_KEYS);

export function isModuleKey(value: unknown): value is ModuleKey {
  return typeof value === "string" && KEY_SET.has(value);
}

export interface ModuleConfigEntry {
  enabled: boolean;
  sort: number;
}

export type ModuleConfig = Record<string, Partial<ModuleConfigEntry>>;

export interface ResolvedModule {
  key: ModuleKey;
  enabled: boolean;
  sort: number;
}

/**
 * Merges the stored (possibly partial / empty) config with the canonical
 * registry into a fully-resolved, ordered list. Unknown keys in the stored
 * map are ignored; missing modules fall back to enabled + canonical order.
 */
export function resolveModules(config: unknown): ResolvedModule[] {
  const cfg: ModuleConfig =
    config && typeof config === "object" && !Array.isArray(config)
      ? (config as ModuleConfig)
      : {};

  return MODULES.map((m, idx) => {
    const entry = cfg[m.key] ?? {};
    const sort =
      typeof entry.sort === "number" && Number.isFinite(entry.sort) ? entry.sort : idx;
    return {
      key: m.key,
      enabled: entry.enabled !== false, // default ON
      sort,
      idx,
    };
  })
    .sort((a, b) => a.sort - b.sort || a.idx - b.idx)
    .map(({ key, enabled, sort }) => ({ key, enabled, sort }));
}

/**
 * Normalizes an arbitrary input into a clean, storable config map: only known
 * keys, boolean `enabled`, contiguous integer `sort` following input order.
 */
export function normalizeModuleConfig(input: unknown): ModuleConfig {
  const list = resolveModules(input);
  const out: ModuleConfig = {};
  list.forEach((m, i) => {
    out[m.key] = { enabled: m.enabled, sort: i };
  });
  return out;
}

/**
 * Free keyword heuristic: which modules best fit a business by its
 * industry/type/description. Used as the instant default and as a safe
 * fallback if the AI suggestion fails. `testimonials` + `faqs` are a
 * near-universal baseline.
 */
export function recommendModules(b: {
  industry?: string | null;
  type?: string | null;
  description?: string | null;
  name?: string | null;
}): ModuleKey[] {
  const hay = `${b.industry ?? ""} ${b.type ?? ""} ${b.description ?? ""} ${b.name ?? ""}`.toLowerCase();
  const has = (...words: string[]) => words.some((w) => hay.includes(w.toLowerCase()));
  // "contact" (closing lead form), "returns" (store returns form) and
  // "order_tracking" (store order lookup) stay on by default for every
  // business type; the owner can switch them off.
  const picked = new Set<ModuleKey>(["testimonials", "faqs", "contact", "returns", "order_tracking"]);

  if (has("מסעד", "קפה", "אוכל", "בר", "מאפ", "קייטר", "food", "restaurant", "cafe", "bakery", "catering"))
    picked.add("menu").add("gallery");
  if (has("אופנה", "בגד", "חנות", "קמעונ", "מוצר", "fashion", "retail", "store", "shop", "boutique"))
    picked.add("gallery").add("gift_cards");
  if (has("קורס", "הכשר", "לימוד", "סדנ", "אקדמ", "חוג", "course", "academy", "school", "training", "workshop"))
    picked.add("courses").add("events");
  if (has("מנוי", "חבר", "מכון כושר", "סטודיו", "כושר", "membership", "gym", "studio", "fitness", "club"))
    picked.add("memberships").add("pricing");
  if (has("ייעוץ", "סוכנ", "שירות", "עורך דין", "רואה חשבון", "agency", "consult", "service", "saas", "marketing"))
    picked.add("process_steps").add("stats").add("team");
  if (has("רפוא", "קליניק", "אסתטי", "יופי", "וולנס", "טיפול", "clinic", "beauty", "wellness", "spa", "aesthetic"))
    picked.add("before_after").add("team");
  if (has("נדל", "שיפוץ", "בנ", "אדריכל", "עיצוב פנים", "real estate", "construction", "design", "renovation"))
    picked.add("before_after").add("gallery").add("process_steps");
  if (has("עמות", "מלכ", "תרומ", "צדק", "nonprofit", "charity", "donation", "ngo"))
    picked.add("donations").add("stats");
  if (has("טק", "תוכנ", "סטארט", "פינטק", "tech", "software", "startup", "fintech", "app"))
    picked.add("stats").add("partners").add("process_steps");

  return MODULE_KEYS.filter((k) => picked.has(k)); // canonical order
}

/**
 * Builds a FULL module config from the type heuristic: the recommended modules
 * are enabled, the rest disabled — in canonical order. Used to give a freshly
 * generated business exactly the storefront modules that fit it (the owner can
 * still flip any of them in the picker).
 *
 * `allowed` narrows the result to the modules the business's site mode permits
 * (see modulesForMode in lib/site-mode.ts) — a brochure site must not be born
 * with the store's returns/order-tracking forms enabled, and a landing page has
 * no modules at all. Omit it to allow every module. Taken as a plain list
 * rather than a mode string so this file stays free of a site-mode import and
 * the two registries can't form an import cycle.
 */
export function configFromRecommended(
  business: {
    industry?: string | null;
    type?: string | null;
    description?: string | null;
    name?: string | null;
  },
  allowed?: readonly ModuleKey[],
): ModuleConfig {
  const rec = new Set(recommendModules(business));
  const permitted = allowed ? new Set<ModuleKey>(allowed) : null;
  const out: ModuleConfig = {};
  MODULES.forEach((m, i) => {
    const enabled = rec.has(m.key) && (permitted === null || permitted.has(m.key));
    out[m.key] = { enabled, sort: i };
  });
  return out;
}
