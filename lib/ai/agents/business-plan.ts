import { runStructured } from "@/lib/ai/run";
import { businessPlanSchema, type BusinessPlan } from "@/lib/ai/schemas/business-plan";
import type { Business } from "@/types/database";

const SYSTEM_PROMPT = `אתה יועץ עסקי בכיר ומנוסה המתמחה בבניית תוכניות עסקיות לעסקים קטנים ובינוניים בישראל.
המשימה שלך: לקבל תיאור של רעיון עסקי ולהפיק תוכנית עסקית מקצועית, ריאליסטית ומעשית.

הנחיות:
- כתוב הכול בעברית תקנית וברורה.
- היה ספציפי וקונקרטי — הימנע מקלישאות ומשפטים כלליים.
- התאם את התוכן לשוק הישראלי ולסוג העסק שתואר.
- אם פרטים חסרים, הנח הנחות סבירות בהתאם לתחום.
- תן ערך אמיתי: תובנות, מספרים ריאליים, וצעדים ברי-ביצוע.
- פלחי לקוחות: הגדר 2-5 פלחים לפי פילוח שוק תקני (דמוגרפי, גיאוגרפי, התנהגותי).
  לכל פלח תן פרופיל ברור, צרכים מרכזיים שהעסק פותר, הערכת גודל כמותית וערוצי הגעה.
  סמן לפחות פלח ליבה אחד (primary) — הפלח שצפוי להניב את רוב ההכנסה.`;

function buildPrompt(business: Business): string {
  const lines: string[] = [
    "להלן פרטי הרעיון העסקי. הפק עבורו תוכנית עסקית מלאה:",
    "",
    business.name ? `שם העסק: ${business.name}` : null,
    business.type ? `סוג העסק: ${business.type}` : null,
    business.industry ? `תחום/ענף: ${business.industry}` : null,
    business.location ? `מיקום: ${business.location}` : null,
    business.target_audience ? `קהל יעד: ${business.target_audience}` : null,
    business.budget != null ? `תקציב התחלתי: ${business.budget} ש"ח` : null,
    business.revenue_goal != null
      ? `יעד הכנסה: ${business.revenue_goal} ש"ח`
      : null,
    "",
    `תיאור הרעיון: ${business.description}`,
  ].filter(Boolean) as string[];

  return lines.join("\n");
}

/**
 * Business Plan Agent (F1). Generates a structured Hebrew business plan
 * from a business idea.
 */
export async function generateBusinessPlan(
  business: Business,
): Promise<BusinessPlan> {
  return runStructured({
    agent: "business_plan",
    businessId: business.id,
    schema: businessPlanSchema,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(business),
  });
}
