import { z } from "zod";

export const dailyBriefSchema = z.object({
  summary: z.string().describe("2-3 משפטים: מצב העסק נכון להיום, בגובה העיניים"),
  highlights: z
    .array(
      z.object({
        kind: z.enum(["win", "risk", "info"]).describe("win=חיובי, risk=דורש טיפול, info=מידע"),
        text: z.string().describe("נקודה בולטת אחת, משפט אחד"),
      }),
    )
    .min(2)
    .describe("2-4 נקודות בולטות מהנתונים"),
  actions: z
    .array(
      z.object({
        title: z.string().describe("הפעולה — קצר ומעשי"),
        why: z.string().describe("למה זה חשוב היום, משפט אחד"),
        priority: z.enum(["high", "medium", "low"]),
      }),
    )
    .min(3)
    .describe("3-5 פעולות מומלצות להיום, מסודרות לפי חשיבות"),
  focus: z.string().describe("משפט מיקוד אחד ליום — מה הדבר האחד הכי חשוב"),
});

export type DailyBriefContent = z.infer<typeof dailyBriefSchema>;
