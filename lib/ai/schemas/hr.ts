import { z } from "zod";

export const hrRoleSchema = z.object({
  jobDescription: z.string().describe("תיאור משרה מלא ומושך (פסקה אחת או שתיים), מוכן לפרסום"),
  responsibilities: z.array(z.string()).describe("4-7 תחומי אחריות עיקריים"),
  requirements: z.array(z.string()).describe("4-7 דרישות סף (ניסיון, כישורים, השכלה)"),
  screeningCriteria: z
    .array(z.string())
    .describe("3-5 קריטריונים לסינון מועמדים בשלב קורות החיים/שיחת טלפון"),
  interviewQuestions: z
    .array(z.string())
    .describe("5-8 שאלות ראיון ממוקדות (כולל מקצועיות והתנהגותיות)"),
});

export type HrRoleContent = z.infer<typeof hrRoleSchema>;
