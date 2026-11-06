import { runStructured } from "@/lib/ai/run";
import { brandingSchema, type BrandingData } from "@/lib/ai/schemas/branding";
import type { Business } from "@/types/database";
import { PUBLIC_COPY_CONFIDENTIALITY } from "@/lib/ai/agents/confidentiality";

const SYSTEM_PROMPT = `אתה מומחה מיתוג ועיצוב גרפי בכיר המתמחה בעסקים קטנים ובינוניים בישראל.
המשימה שלך: לבנות זהות מותג מלאה ומקצועית עבור עסק, שתשקף את ערכיו ותמשוך את קהל היעד שלו.

הנחיות:
- כתוב הכול בעברית תקנית, חוץ מ-logoPrompt שיהיה באנגלית.
- השם, הסלוגן והצבעים חייבים להתאים לתחום, לקהל היעד ולרגש שהעסק רוצה לעורר.
- צבעי ה-HEX חייבים להיות מדויקים ולהרכיב פלטה הרמונית.
- הפונטים חייבים להיות מ-Google Fonts — ריאליים וקיימים.
- ה-logoPrompt צריך להיות מפורט ומקצועי, כך שיפיק לוגו טוב ב-DALL-E.
${PUBLIC_COPY_CONFIDENTIALITY}`;

function buildPrompt(business: Business): string {
  const lines: string[] = [
    "להלן פרטי העסק. בנה עבורו זהות מותג מלאה:",
    "",
    business.name ? `שם העסק: ${business.name}` : null,
    business.type ? `סוג העסק: ${business.type}` : null,
    business.industry ? `תחום/ענף: ${business.industry}` : null,
    business.location ? `מיקום: ${business.location}` : null,
    business.target_audience ? `קהל יעד: ${business.target_audience}` : null,
    "",
    `תיאור הרעיון: ${business.description}`,
  ].filter(Boolean) as string[];

  return lines.join("\n");
}

export async function generateBranding(
  business: Business,
): Promise<BrandingData> {
  return runStructured({
    agent: "branding",
    businessId: business.id,
    schema: brandingSchema,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(business),
  });
}
