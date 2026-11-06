import { runStructured } from "@/lib/ai/run";
import {
  socialMediaStrategySchema,
  type SocialMediaStrategy,
} from "@/lib/ai/schemas/social-media";
import type { Business } from "@/types/database";
import { PUBLIC_COPY_CONFIDENTIALITY } from "@/lib/ai/agents/confidentiality";

const SYSTEM_PROMPT = `אתה מומחה שיווק ברשתות חברתיות המתמחה בעסקים בישראל.
המשימה שלך: לבנות אסטרטגיית נוכחות מלאה ל-4 פלטפורמות — אינסטגרם, פייסבוק, לינקדאין וטיקטוק.

הנחיות:
- כתוב הכול בעברית.
- התאם כל אסטרטגיה למאפייני הפלטפורמה ולקהל שבה:
  - instagram: ויזואלי, סטוריז וריילס, אסתטיקה, האשטאגים.
  - facebook: קהילה, קבוצות, שיתופים, קהל מבוגר יותר.
  - linkedin: מקצועי, B2B, מומחיות, תוכן ערכי.
  - tiktok: וידאו קצר, טרנדים, אותנטיות, קהל צעיר.
- היה ספציפי וקונקרטי לעסק — לא עצות גנריות.
- תן ביו מוכן לשימוש, עמודי תוכן ברורים, ושעות פרסום ריאליות לישראל.
${PUBLIC_COPY_CONFIDENTIALITY}`;

function buildPrompt(business: Business): string {
  const lines: string[] = [
    "בנה אסטרטגיית רשתות חברתיות מלאה ל-4 הפלטפורמות עבור העסק הבא:",
    "",
    business.name ? `שם: ${business.name}` : null,
    business.type ? `סוג: ${business.type}` : null,
    business.industry ? `תחום: ${business.industry}` : null,
    business.location ? `מיקום: ${business.location}` : null,
    business.target_audience ? `קהל יעד: ${business.target_audience}` : null,
    `תיאור: ${business.description}`,
    "",
    "החזר אסטרטגיה לכל אחת מהפלטפורמות: instagram, facebook, linkedin, tiktok.",
  ].filter(Boolean) as string[];

  return lines.join("\n");
}

export async function generateSocialStrategy(
  business: Business,
): Promise<SocialMediaStrategy> {
  return runStructured({
    agent: "social_media",
    businessId: business.id,
    schema: socialMediaStrategySchema,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(business),
  });
}
