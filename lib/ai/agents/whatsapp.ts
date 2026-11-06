import { runStructured } from "@/lib/ai/run";
import { whatsappSetupSchema, type WhatsappSetup, type FaqItem } from "@/lib/ai/schemas/whatsapp";
import { whatsappGoalLabels, type WhatsappGoal } from "@/lib/ai/schemas/whatsapp";
import type { Business, WhatsappConfig } from "@/types/database";
import { PUBLIC_COPY_CONFIDENTIALITY } from "@/lib/ai/agents/confidentiality";
import { CUSTOMER_CHAT_SCOPE } from "@/lib/ai/agents/scope";

const SETUP_SYSTEM = `אתה מומחה לשירות לקוחות ואוטומציה עסקית בישראל.
המשימה שלך: להגדיר סוכן וואטסאפ חכם לעסק — הודעת פתיחה, טון, מטרות ושאלות נפוצות.

הנחיות:
- כתוב הכול בעברית טבעית וזורמת, מתאימה לוואטסאפ (קצר, ידידותי, אמוג'ים במידה).
- ה-FAQ צריך להיות ספציפי לעסק: שעות פעילות, מחירים, שירותים, מיקום, תהליך הזמנה וכו'.
- התשובות צריכות להיות מוכנות לשליחה ללקוח אמיתי.
${PUBLIC_COPY_CONFIDENTIALITY}`;

function setupPrompt(business: Business): string {
  return [
    "הגדר סוכן וואטסאפ לעסק הבא:",
    "",
    business.name ? `שם: ${business.name}` : null,
    business.type ? `סוג: ${business.type}` : null,
    business.industry ? `תחום: ${business.industry}` : null,
    business.location ? `מיקום: ${business.location}` : null,
    business.target_audience ? `קהל יעד: ${business.target_audience}` : null,
    `תיאור: ${business.description}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Generates a starter WhatsApp agent configuration from business context. */
export async function generateWhatsappSetup(
  business: Business,
): Promise<WhatsappSetup> {
  return runStructured({
    agent: "whatsapp",
    businessId: business.id,
    schema: whatsappSetupSchema,
    system: SETUP_SYSTEM,
    prompt: setupPrompt(business),
  });
}

/**
 * Builds the system prompt for every CUSTOMER-facing chat surface — the
 * WhatsApp webhook, the dashboard playground, and the storefront chat widget
 * (app/api/store-chat) all call this one builder. Anything appended here
 * therefore lands on all three at once, which is why the scope fence lives at
 * this level rather than being re-stated per route.
 *
 * The agent answers as the business would on WhatsApp, using the config + FAQ.
 */
export function buildWhatsappSystemPrompt(
  business: Business,
  config: WhatsappConfig,
): string {
  const goals = (Array.isArray(config.goals) ? (config.goals as WhatsappGoal[]) : [])
    .map((g) => whatsappGoalLabels[g] ?? g)
    .join(", ");
  const faq = (Array.isArray(config.faq) ? (config.faq as FaqItem[]) : [])
    .map((f, i) => `${i + 1}. ש: ${f.question}\n   ת: ${f.answer}`)
    .join("\n");

  return `אתה סוכן הוואטסאפ של העסק "${business.name ?? "העסק"}".
אתה מדבר עם לקוחות בוואטסאפ בעברית, בצורה ${config.tone ?? "חמה וידידותית"}.

## הנחיות התנהגות
- כתוב קצר וטבעי כמו בצ'אט וואטסאפ אמיתי — לא פסקאות ארוכות.
- אמוג'ים במידה, לא מוגזם.
- המטרות שלך: ${goals || "מענה ללקוחות ואיסוף פרטים"}.
- אם הלקוח מתעניין במוצר/שירות — נסה לאסוף שם וטלפון כדי שנחזור אליו (ליד).
- אם אינך יודע משהו — אל תמציא. הצע להעביר לנציג אנושי.
- ענה רק על סמך המידע על העסק וה-FAQ למטה.

## פרטי העסק
שם: ${business.name ?? "—"}
תחום: ${business.industry ?? business.type ?? "—"}
מיקום: ${business.location ?? "—"}
תיאור: ${business.description}

## שאלות נפוצות (FAQ)
${faq || "אין עדיין שאלות נפוצות מוגדרות."}
${PUBLIC_COPY_CONFIDENTIALITY}
אם לקוח שואל ישירות מאיפה נשלח, מי הספק או איך העסק בנוי — אל תענה על כך ואל תמציא.
החזר את השיחה למה שמעניין אותו: המוצר, זמן האספקה והאחריות.
${CUSTOMER_CHAT_SCOPE}`;
}
