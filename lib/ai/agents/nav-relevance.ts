import { z } from "zod";

import { runStructured } from "@/lib/ai/run";
import { isHospitality } from "@/lib/business-type";
import type { Business } from "@/types/database";

/**
 * Dashboard nav keys that are genuinely vertical-specific rather than useful
 * to nearly every business (crm/content/analytics/reviews etc. stay
 * untouched). "לוח לילות" (rentals) is the concrete bug this fixes: it was
 * gated purely by plan entitlement (lib/entitlements.ts), so a retail store
 * on a Pro+ plan saw the exact same nav item a צימר does.
 */
export const NAV_RELEVANCE_CANDIDATES = [
  "rentals",
  "bookings",
  "hr",
  "quotes",
  "projects",
] as const;

export type NavRelevanceCandidate = (typeof NAV_RELEVANCE_CANDIDATES)[number];

const CANDIDATE_LABELS: Record<NavRelevanceCandidate, string> = {
  rentals: "לוח לילות — יחידות אירוח, תפוסה ותמחור לילה (צימרים, וילות, אירוח)",
  bookings: "יומן תורים — קביעת תורים ללקוחות (עסקי שירות שנפגשים עם לקוחות)",
  hr: "גיוס ו-HR — משרות, מועמדים וניהול עובדים (עסקים שמעסיקים או מגייסים)",
  quotes: "הצעות מחיר — בניית הצעות מחיר ומעקב אחריהן (עסקי B2B/פרויקטים)",
  projects: "פרויקטים — ניהול משימות ועבודה מול לקוח (סוכנויות, עסקי שירות מבוססי פרויקט)",
};

const nabSchema = z.object({
  hidden: z
    .array(z.enum(NAV_RELEVANCE_CANDIDATES))
    .describe("מפתחות המודולים מהרשימה שאינם רלוונטיים לעסק הזה"),
  reason: z.string().describe("נימוק קצר בעברית, משפט אחד"),
});

/**
 * Fallback used when the model call fails (quota, rate limit, transient
 * error) — fail OPEN. Only `rentals` is decided (via the existing keyword
 * heuristic); the other candidates stay visible rather than risk hiding a
 * module a real business needs.
 */
function fallbackHidden(business: Pick<Business, "industry" | "type" | "description" | "name">): NavRelevanceCandidate[] {
  return isHospitality(business) ? [] : ["rentals"];
}

/**
 * Classifies which of the vertical-specific nav candidates do NOT fit this
 * business, given its own name/industry/type/description. Never throws —
 * callers get a best-effort list either way.
 */
export async function classifyHiddenNavKeys(
  business: Pick<Business, "id" | "name" | "industry" | "type" | "description">,
): Promise<NavRelevanceCandidate[]> {
  try {
    const result = await runStructured({
      agent: "nav_relevance",
      businessId: business.id,
      schema: nabSchema,
      system: `אתה עוזר שמחליט אילו מסכי ניהול ייעודיים-לענף להציג בדשבורד של עסק, לפי מה שהעסק בפועל מוכר/עושה.
לפניך רשימת מסכים ייעודיים (לא מסכים כלליים כמו לקוחות, תוכן או אנליטיקס — אלה תמיד מוצגים):
${NAV_RELEVANCE_CANDIDATES.map((k) => `- ${k}: ${CANDIDATE_LABELS[k]}`).join("\n")}
החזר את רשימת המפתחות שאינם רלוונטיים לעסק הזה (יש להסתיר אותם), ונימוק קצר. אם עסק עמום/לא ברור — עדיף להשאיר גלוי (רשימה ריקה) מאשר להסתיר בטעות.`,
      prompt: [
        `שם: ${business.name ?? ""}`,
        `תחום: ${business.industry ?? business.type ?? ""}`,
        `תיאור: ${business.description.slice(0, 400)}`,
      ].join("\n"),
    });
    return result.hidden;
  } catch {
    return fallbackHidden(business);
  }
}
