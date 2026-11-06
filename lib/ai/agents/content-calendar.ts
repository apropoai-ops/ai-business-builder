import { runStructured } from "@/lib/ai/run";
import {
  contentCalendarSchema,
  calendarPeriodLabels,
  type ContentCalendarPlan,
  type CalendarPeriod,
} from "@/lib/ai/schemas/content-calendar";
import type { Business } from "@/types/database";

const SYSTEM_PROMPT = `אתה אסטרטג תוכן בכיר ברמה של סוכנות מובילה, המתמחה בבניית תוכניות תוכן לעסקים בישראל.
המשימה שלך: לבנות לוח תוכן (Content Calendar) מתוזמן, מגוון ובר-ביצוע לתקופה שתינתן — כזה שבעל עסק עסוק באמת יכול לעמוד בו.

עקרונות איכות (חובה):
- כל פריט = נושא ספציפי + רעיון ביצוע ברור ומפורט (מה מצלמים/כותבים, מה הזווית, מה ה-Hook) — לא "פוסט על המוצרים שלנו".
- ה-idea של כל פריט צריך להיות מפורט מספיק כדי להתחיל לעבוד ממנו מיד: 2-3 משפטים עם הזווית, הפורמט וקריאה לפעולה מוצעת.
- תמהיל 40/30/20/10: כ-40% ערך ומומחיות (טיפים, ידע), כ-30% מאחורי הקלעים ואותנטיות, כ-20% מכירה ישירה, כ-10% מעורבות קהילה (שאלות, סקרים).
- פזר הגיוני לאורך התקופה: אל תרכז הכול ביום אחד, שמור על קצב קבוע, נצל ימי שיא (ראשון-חמישי לעסקים, סופ"ש לפנאי).
- התאם תדירות לפלטפורמה: אינסטגרם/פייסבוק 2-4 בשבוע, טיקטוק לפי אופי העסק, לינקדאין 1-2 בשבוע, בלוג 1-2 בחודש, אימייל 1-2 בחודש.
- שלב סדרות חוזרות שבונות הרגל אצל הקהל (למשל "טיפ של יום ראשון") — וציין את שם הסדרה בכותרת.
- אם התקופה כוללת מועדים ישראליים רלוונטיים (חגים, עונות מכירה), שלב אותם.
- כתוב הכול בעברית תקנית וטבעית.`;

const PERIOD_GUIDANCE: Record<CalendarPeriod, string> = {
  week: "תקופה: שבוע אחד (7 ימים). הפק 5-8 פריטי תוכן.",
  month: "תקופה: חודש (30 ימים). הפק 16-24 פריטי תוכן.",
  quarter: "תקופה: רבעון (90 ימים). הפק 30-45 פריטי תוכן, מחולקים לאורך הרבעון.",
};

function buildPrompt(business: Business, period: CalendarPeriod): string {
  const lines: string[] = [
    `בנה לוח תוכן ל${calendarPeriodLabels[period]} עבור העסק הבא.`,
    PERIOD_GUIDANCE[period],
    "",
    "פרטי העסק:",
    business.name ? `שם: ${business.name}` : null,
    business.type ? `סוג: ${business.type}` : null,
    business.industry ? `תחום: ${business.industry}` : null,
    business.target_audience ? `קהל יעד: ${business.target_audience}` : null,
    `תיאור: ${business.description}`,
    "",
    "עבור כל פריט ציין dayOffset (מספר ימים מתחילת התקופה), פלטפורמה, סוג תוכן, כותרת ורעיון.",
  ].filter(Boolean) as string[];

  return lines.join("\n");
}

export async function generateContentCalendar(
  business: Business,
  period: CalendarPeriod,
): Promise<ContentCalendarPlan> {
  return runStructured({
    agent: "content_calendar",
    businessId: business.id,
    schema: contentCalendarSchema,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(business, period),
  });
}
