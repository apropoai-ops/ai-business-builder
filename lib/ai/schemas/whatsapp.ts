import { z } from "zod";

export const whatsappGoalValues = [
  "capture_leads",
  "answer_faq",
  "bookings",
  "sales",
] as const;

export type WhatsappGoal = (typeof whatsappGoalValues)[number];

export const whatsappGoalLabels: Record<WhatsappGoal, string> = {
  capture_leads: "איסוף לידים",
  answer_faq: "מענה לשאלות נפוצות",
  bookings: "תיאום הזמנות/פגישות",
  sales: "מכירות",
};

export const whatsappSetupSchema = z.object({
  greeting: z
    .string()
    .describe("הודעת פתיחה ידידותית שהסוכן ישלח ללקוח חדש (1-2 משפטים)"),
  tone: z
    .string()
    .describe("תיאור קצר של טון הדיבור המומלץ (למשל: חם וידידותי, מקצועי)"),
  goals: z
    .array(z.enum(whatsappGoalValues))
    .describe("המטרות המרכזיות של הסוכן"),
  faq: z
    .array(
      z.object({
        question: z.string().describe("שאלה נפוצה שלקוחות שואלים"),
        answer: z.string().describe("תשובה ברורה ומדויקת"),
      }),
    )
    .min(4)
    .describe("6-10 שאלות ותשובות נפוצות הרלוונטיות לעסק"),
});

export type WhatsappSetup = z.infer<typeof whatsappSetupSchema>;

export type FaqItem = { question: string; answer: string };
