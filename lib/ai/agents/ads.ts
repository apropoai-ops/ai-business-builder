import { runStructured } from "@/lib/ai/run";
import { adStrategySchema, type AdStrategy } from "@/lib/ai/schemas/ads";
import type { Business } from "@/types/database";
import { PUBLIC_COPY_CONFIDENTIALITY } from "@/lib/ai/agents/confidentiality";

const SYSTEM_PROMPT = `אתה מומחה פרסום ממומן (Performance Marketing) המתמחה בעסקים בישראל.
המשימה שלך: לבנות תוכנית פרסום מלאה ל-3 פלטפורמות — Meta (פייסבוק+אינסטגרם), Google Ads, ו-TikTok Ads.

הנחיות:
- כתוב הכול בעברית (מלבד שמות פלטפורמות ומונחים מקצועיים מקובלים).
- התאם כל תוכנית למאפייני הפלטפורמה ולקהל שבה:
  - meta: מיקוד לפי תחומי עניין/דמוגרפיה, קריאייטיב ויזואלי, קהלים דומים (lookalike).
  - google: מבוסס כוונת חיפוש — מילות מפתח, קמפיינים בחיפוש, מיקוד לפי כוונה.
  - tiktok: וידאו קצר ואותנטי, טרנדים, קהל צעיר, קריאייטיב מבוסס יוצרים.
- תן המלצות תקציב ריאליות בשקלים לעסק קטן בישראל.
- היה ספציפי וקונקרטי לעסק — לא עצות גנריות. שמות קמפיינים, קהלים וטקסטים מוכנים לשימוש.
${PUBLIC_COPY_CONFIDENTIALITY}`;

function buildPrompt(business: Business): string {
  const lines: (string | null)[] = [
    "בנה תוכנית פרסום ממומן מלאה ל-3 הפלטפורמות עבור העסק הבא:",
    "",
    business.name ? `שם: ${business.name}` : null,
    business.type ? `סוג: ${business.type}` : null,
    business.industry ? `תחום: ${business.industry}` : null,
    business.location ? `מיקום: ${business.location}` : null,
    business.target_audience ? `קהל יעד: ${business.target_audience}` : null,
    business.budget ? `תקציב: ${business.budget}` : null,
    `תיאור: ${business.description}`,
    "",
    "החזר תוכנית פרסום לכל אחת מהפלטפורמות: meta, google, tiktok.",
  ];

  return lines.filter(Boolean).join("\n");
}

export async function generateAdStrategy(business: Business): Promise<AdStrategy> {
  return runStructured({
    agent: "ads",
    businessId: business.id,
    schema: adStrategySchema,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(business),
  });
}
