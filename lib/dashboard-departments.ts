/**
 * The dashboard's information architecture — the 27 owner screens grouped by
 * the JOB the owner came to do, in one place.
 *
 * This exists because the grouping is rendered TWICE: as the sidebar
 * (components/shared/business-nav.tsx) and as the launchpad on the סקירה screen
 * (app/(dashboard)/businesses/[businessId]/overview/page.tsx). They used to
 * disagree — the sidebar listed all 27 screens flat while the overview showed
 * an arbitrary 9 of them under two headings that matched nothing — so a screen
 * could exist in one and not the other, and adding a screen meant remembering
 * both. One array, both surfaces.
 *
 * Each department's `id` is also its colour token (`--dept-<id>` in
 * app/globals.css) and the id prefix for its heading element.
 *
 * Ordering: inside a department, broad → narrow; between departments, roughly
 * daily → occasional, so the screens opened every morning sit at the top.
 */
import {
  LayoutDashboard,
  BarChart3,
  Gauge,
  FileText,
  Search,
  Globe,
  Users,
  MessageSquare,
  PenLine,
  CalendarDays,
  Share2,
  Megaphone,
  MessageCircle,
  ShoppingBag,
  PackagePlus,
  BedDouble,
  ReceiptText,
  Star,
  Mail,
  CalendarClock,
  FolderKanban,
  Users2,
  LayoutGrid,
  TrendingUp,
  Zap,
  Plug,
  UserPlus,
  DatabaseBackup,
  type LucideIcon,
} from "lucide-react";

import {
  modeAllowsNav,
  modeAllowsStoreScreen,
  siteModeDef,
  type BusinessNavKey,
} from "./site-mode";

export type DepartmentItem = {
  key: BusinessNavKey;
  label: string;
  icon: LucideIcon;
  /** Shown on the overview card — what the screen is FOR, in one line. */
  blurb: string;
};

export type Department = {
  /** Colour token suffix (`--dept-<id>`) and heading id prefix. */
  id: string;
  label: string;
  items: DepartmentItem[];
};

export const DEPARTMENTS: Department[] = [
  {
    id: "command",
    label: "פיקוד ובקרה",
    items: [
      { key: "overview", label: "סקירה", icon: LayoutDashboard, blurb: "כל מה שקורה בעסק במבט אחד" },
      { key: "analytics", label: "אנליטיקס", icon: BarChart3, blurb: "מי מבקר באתר ומאיפה" },
      { key: "reports", label: "דוחות", icon: TrendingUp, blurb: "הכנסות, הוצאות ומגמות" },
      { key: "score", label: "ציון ותובנות", icon: Gauge, blurb: "ציון הבריאות של העסק" },
    ],
  },
  {
    id: "sales",
    label: "מכירות",
    items: [
      { key: "store", label: "חנות", icon: ShoppingBag, blurb: "מוצרים, מלאי והזמנות" },
      { key: "new-product", label: "הוספת מוצר", icon: PackagePlus, blurb: "הוספת מוצר חדש — ידנית, ב-AI או מקובץ CSV" },
      { key: "bookings", label: "יומן תורים", icon: CalendarClock, blurb: "תורים, זמינות ואישורים" },
      { key: "rentals", label: "לוח לילות", icon: BedDouble, blurb: "יחידות, תפוסה ותמחור לילה" },
      { key: "quotes", label: "הצעות מחיר", icon: ReceiptText, blurb: "בניית הצעות ומעקב אחריהן" },
    ],
  },
  {
    id: "customers",
    label: "לקוחות",
    items: [
      { key: "crm", label: "לקוחות ומכירות", icon: Users, blurb: "לידים, לקוחות והמעקב אחריהם" },
      { key: "reviews", label: "ביקורות", icon: Star, blurb: "איסוף ביקורות והצגתן באתר" },
    ],
  },
  {
    id: "marketing",
    label: "שיווק ותוכן",
    items: [
      { key: "content", label: "מנוע תוכן", icon: PenLine, blurb: "כתיבת פוסטים ומאמרים ב-AI" },
      { key: "calendar", label: "לוח תוכן", icon: CalendarDays, blurb: "תכנון ותזמון הפרסומים" },
      { key: "social", label: "רשתות חברתיות", icon: Share2, blurb: "פרסום וניהול הרשתות" },
      { key: "ads", label: "פרסום ממומן", icon: Megaphone, blurb: "קמפיינים בגוגל ובמטא" },
      { key: "newsletter", label: "ניוזלטר", icon: Mail, blurb: "רשימת תפוצה ודיוור" },
      { key: "whatsapp", label: "סוכן וואטסאפ", icon: MessageCircle, blurb: "מענה אוטומטי ללקוחות" },
    ],
  },
  {
    id: "website",
    label: "האתר שלי",
    items: [
      // מיתוג was merged into this screen — one job, one place.
      { key: "website", label: "אתר ומיתוג", icon: Globe, blurb: "עיצוב האתר, לוגו וצבעים" },
      { key: "sections", label: "מודולים לאתר", icon: LayoutGrid, blurb: "אילו מקטעים מופיעים באתר" },
    ],
  },
  {
    id: "strategy",
    label: "אסטרטגיה",
    items: [
      { key: "plan", label: "תוכנית עסקית", icon: FileText, blurb: "התוכנית שנבנתה לעסק" },
      { key: "research", label: "מחקר שוק", icon: Search, blurb: "מתחרים, קהל ומגמות" },
      { key: "ceo-chat", label: "AI CEO", icon: MessageSquare, blurb: "יועץ שמכיר את העסק שלך" },
    ],
  },
  {
    id: "system",
    label: "תפעול והגדרות",
    items: [
      { key: "automations", label: "אוטומציות", icon: Zap, blurb: "פעולות שרצות מעצמן" },
      { key: "projects", label: "פרויקטים", icon: FolderKanban, blurb: "משימות וניהול עבודה" },
      { key: "hr", label: "גיוס ו-HR", icon: Users2, blurb: "משרות, מועמדים ועובדים" },
      { key: "members", label: "חברי צוות", icon: UserPlus, blurb: "מי עוד יכול לנהל את העסק" },
      { key: "integrations", label: "אינטגרציות", icon: Plug, blurb: "חיבור לשירותים חיצוניים" },
      { key: "export", label: "גיבוי וייצוא", icon: DatabaseBackup, blurb: "הורדת הנתונים שלך" },
    ],
  },
];

/**
 * The departments this particular business may actually see, with the screens
 * its build mode doesn't have removed and empty departments dropped.
 *
 * The two exceptions are the same ones lib/site-mode.ts documents: the חנות
 * screen also opens for a business that sells nights, and לוח לילות is gated by
 * the PLAN rather than the build mode — hidden outright rather than
 * shown-and-404ing, because a link that only leads to an upgrade wall is noise.
 */
export function visibleDepartments(opts: {
  siteMode?: string | null;
  sellsNights?: boolean;
  hasRentals?: boolean;
  /**
   * AI-picked (lib/ai/agents/nav-relevance.ts) vertical-specific nav keys
   * this business doesn't need — a strict subtraction from whatever the
   * plan/mode below already allow. See migration 0092.
   */
  hiddenNavKeys?: string[];
}): Department[] {
  const mode = siteModeDef(opts.siteMode).key;

  const allowed = (item: DepartmentItem) => {
    if (opts.hiddenNavKeys?.includes(item.key)) return false;
    return item.key === "store"
      ? modeAllowsStoreScreen(mode, { sellsNights: opts.sellsNights })
      : item.key === "rentals"
        ? Boolean(opts.hasRentals)
        : modeAllowsNav(mode, item.key);
  };

  return DEPARTMENTS.map((d) => ({ ...d, items: d.items.filter(allowed) })).filter(
    (d) => d.items.length > 0,
  );
}
