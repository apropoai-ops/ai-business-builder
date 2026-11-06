import { z } from "zod";

export const crmFollowupSchema = z.object({
  message: z
    .string()
    .describe(
      "הודעת מעקב קצרה וחמה בעברית לשליחה בוואטסאפ ללקוח/ליד, 20-60 מילים",
    ),
  email: z
    .object({
      subject: z.string().describe("כותרת קצרה וברורה לאימייל, עד 10 מילים"),
      body: z.string().describe("גוף הודעת אימייל מקצועית וחמה בעברית, 40-120 מילים"),
    })
    .nullable()
    .describe("טיוטת אימייל מקבילה — רק אם צוין שיש כתובת אימייל ללקוח/ליד, אחרת null"),
});

export type CrmFollowup = z.infer<typeof crmFollowupSchema>;
