import { z } from "zod";

export const marketResearchSchema = z.object({
  competitors: z
    .array(
      z.object({
        name: z.string().describe("שם המתחרה"),
        strengths: z.array(z.string()).describe("נקודות חוזק"),
        weaknesses: z.array(z.string()).describe("נקודות חולשה"),
        opportunities: z.array(z.string()).describe("הזדמנויות שנפתחות"),
      }),
    )
    .describe("ניתוח 3-5 מתחרים מרכזיים בשוק"),

  swot: z.object({
    strengths: z.array(z.string()).describe("חוזקות של העסק"),
    weaknesses: z.array(z.string()).describe("חולשות של העסק"),
    opportunities: z.array(z.string()).describe("הזדמנויות בשוק"),
    threats: z.array(z.string()).describe("איומים חיצוניים"),
  }),

  opportunities: z
    .array(
      z.object({
        title: z.string().describe("כותרת ההזדמנות"),
        description: z.string().describe("תיאור ההזדמנות ומדוע היא רלוונטית"),
        priority: z.enum(["גבוהה", "בינונית", "נמוכה"]).describe("עדיפות"),
      }),
    )
    .describe("הזדמנויות שוק שהעסק יכול לנצל"),

  positioning: z
    .string()
    .describe(
      "המיצוב המומלץ בשוק: כיצד להציג את העסק ביחס למתחרים, מה הדיפרנציאציה, ומה המסר המרכזי ללקוחות",
    ),
});

export type MarketResearchData = z.infer<typeof marketResearchSchema>;
