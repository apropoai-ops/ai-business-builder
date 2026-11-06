import { z } from "zod";

export const calendarPeriodEnum = z.enum(["week", "month", "quarter"]);
export type CalendarPeriod = z.infer<typeof calendarPeriodEnum>;

export const calendarPeriodLabels: Record<CalendarPeriod, string> = {
  week: "שבוע",
  month: "חודש",
  quarter: "רבעון",
};

export const platformLabels: Record<string, string> = {
  instagram: "אינסטגרם",
  facebook: "פייסבוק",
  linkedin: "לינקדאין",
  tiktok: "טיקטוק",
  blog: "בלוג",
  email: "אימייל",
};

export const calendarEntrySchema = z.object({
  dayOffset: z
    .number()
    .int()
    .min(0)
    .describe("מספר הימים מתחילת התקופה שבו לפרסם (0 = היום הראשון)"),
  platform: z
    .enum(["instagram", "facebook", "linkedin", "tiktok", "blog", "email"])
    .describe("הפלטפורמה לפרסום"),
  contentType: z
    .enum(["post", "reel", "story", "article", "newsletter"])
    .describe("סוג התוכן"),
  title: z.string().describe("כותרת קצרה לפריט התוכן"),
  idea: z.string().describe("תיאור קצר של רעיון התוכן והמסר המרכזי"),
});

export const contentCalendarSchema = z.object({
  entries: z
    .array(calendarEntrySchema)
    .min(1)
    .describe("רשימת פריטי תוכן מתוזמנים לאורך התקופה"),
});

export type ContentCalendarPlan = z.infer<typeof contentCalendarSchema>;
