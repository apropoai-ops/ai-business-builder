import { z } from "zod";

export const insightsSchema = z.object({
  headline: z.string().describe("משפט אחד שמסכם את מצב העסק כרגע"),
  growth: z.string().describe("ניתוח צמיחה — מה עובד ומה ההזדמנות הגדולה לצמיחה"),
  churnRisk: z.string().describe("ניתוח סיכוני נטישה/שימור — מה מסכן את המשך הפעילות"),
  revenue: z.string().describe("ניתוח הכנסות — מצב ההכנסות וכיצד להגדיל אותן"),
  conversion: z.string().describe("ניתוח המרת לידים — איך נסגרות עסקאות ואיפה דולפים לקוחות"),
  recommendations: z
    .array(
      z.object({
        title: z.string().describe("כותרת קצרה להמלצה"),
        action: z.string().describe("צעד קונקרטי וברור לביצוע"),
        priority: z.enum(["high", "medium", "low"]).describe("עדיפות"),
      }),
    )
    .describe("3-5 המלצות מתועדפות לפעולה"),
});

export type Insights = z.infer<typeof insightsSchema>;
