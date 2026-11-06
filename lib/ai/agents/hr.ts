import { runStructured } from "@/lib/ai/run";
import { hrRoleSchema, type HrRoleContent } from "@/lib/ai/schemas/hr";
import type { Business } from "@/types/database";

const SYSTEM_PROMPT = `אתה מנהל גיוס (HR) מנוסה המתמחה בעסקים קטנים ובינוניים בישראל.
על סמך פרטי העסק והתפקיד, הפק חבילת גיוס מלאה ומקצועית.

הנחיות:
- כתוב הכול בעברית, מקצועי וברור.
- התאם את התוכן לעסק הספציפי ולתחום שלו — לא טקסט גנרי.
- תיאור המשרה צריך להיות מוכן לפרסום מיידי.
- שאלות הראיון: שילוב של מקצועיות והתנהגותיות, שחושפות התאמה אמיתית.`;

function buildPrompt(business: Business, role: string, details?: string): string {
  return [
    `העסק: ${business.name ?? "ללא שם"} (${business.industry ?? business.type ?? "כללי"})`,
    `תיאור העסק: ${business.description.slice(0, 250)}`,
    business.location ? `מיקום: ${business.location}` : "",
    "",
    `התפקיד לגיוס: ${role}`,
    details ? `פרטים נוספים: ${details.slice(0, 400)}` : "",
    "",
    "הפק: תיאור משרה, תחומי אחריות, דרישות, קריטריונים לסינון מועמדים, ושאלות ראיון.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateHrRole(
  business: Business,
  role: string,
  details?: string,
): Promise<HrRoleContent> {
  return runStructured({
    agent: "hr",
    businessId: business.id,
    schema: hrRoleSchema,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(business, role, details),
  });
}
