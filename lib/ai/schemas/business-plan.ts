import { z } from "zod";

/**
 * Structured output schema for the Business Plan Agent (F1).
 * Enforces the shape of the AI response and maps 1:1 to business_profiles.
 * All textual content is expected in Hebrew.
 */
export const businessPlanSchema = z.object({
  executiveSummary: z
    .string()
    .describe("תקציר מנהלים של 2-4 פסקאות המסכם את העסק וההזדמנות"),

  businessModel: z.object({
    description: z.string().describe("תיאור מודל העסק וכיצד הוא מייצר ערך"),
    keyActivities: z.array(z.string()).describe("פעילויות מפתח"),
    keyResources: z.array(z.string()).describe("משאבי מפתח נדרשים"),
    channels: z.array(z.string()).describe("ערוצי הפצה ומכירה"),
  }),

  valueProposition: z
    .string()
    .describe("הצעת הערך הייחודית — למה לקוחות יבחרו בעסק"),

  revenueStreams: z
    .array(
      z.object({
        name: z.string().describe("שם מקור ההכנסה"),
        description: z.string().describe("תיאור קצר"),
      }),
    )
    .describe("מקורות הכנסה"),

  customerSegments: z
    .array(
      z.object({
        name: z
          .string()
          .describe("שם הפלח — קצר וממוקד (למשל: משפחות צעירות בגוש דן)"),
        profile: z
          .string()
          .describe(
            "פרופיל הפלח: דמוגרפיה (גיל, מיקום, הכנסה), מאפיינים והתנהגות קנייה — 2-3 משפטים",
          ),
        needs: z
          .array(z.string())
          .describe("2-4 צרכים או כאבים מרכזיים שהעסק פותר עבור הפלח"),
        size: z
          .string()
          .describe(
            "הערכת גודל הפלח ופוטנציאל השוק — כמותית ככל האפשר (למשל: כ-50 אלף משקי בית באזור)",
          ),
        channels: z
          .array(z.string())
          .describe("2-3 ערוצים יעילים להגעה לפלח (למשל: אינסטגרם, גוגל, המלצות)"),
        priority: z
          .enum(["primary", "secondary"])
          .describe("primary = פלח ליבה שמניב את רוב ההכנסה, secondary = פלח משני"),
      }),
    )
    .describe(
      "2-5 פלחי לקוחות לפי פילוח שוק תקני (Business Model Canvas) — לפחות פלח ליבה אחד",
    ),

  pricingStrategy: z.object({
    model: z.string().describe("גישת התמחור (לדוגמה: מנוי, פר-פרויקט, חבילות)"),
    tiers: z
      .array(
        z.object({
          name: z.string().describe("שם החבילה"),
          price: z.string().describe("מחיר או טווח מחירים"),
          description: z.string().describe("מה כלול בחבילה"),
        }),
      )
      .describe("חבילות/רמות תמחור"),
  }),

  launchPlan: z
    .array(
      z.object({
        phase: z.string().describe("שם השלב"),
        durationWeeks: z.number().describe("משך השלב בשבועות"),
        tasks: z.array(z.string()).describe("משימות מרכזיות בשלב"),
      }),
    )
    .describe("תוכנית השקה מדורגת"),
});

export type BusinessPlan = z.infer<typeof businessPlanSchema>;
