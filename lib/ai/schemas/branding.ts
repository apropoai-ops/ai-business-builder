import { z } from "zod";

export const brandingSchema = z.object({
  brandName: z.string().describe("שם המותג המוצע (אם לעסק אין שם קבוע)"),

  slogan: z.string().describe("סלוגן קצר וזכיר — משפט אחד, לא יותר מ-8 מילים"),

  mission: z
    .string()
    .describe("משימת המותג — מה הוא עושה ולמה, בשפה ברורה וקצרה"),

  vision: z
    .string()
    .describe("חזון המותג — לאן הוא שואף להגיע בטווח הארוך"),

  personality: z
    .array(z.string())
    .describe("5 תכונות אישיות של המותג (לדוגמה: אמין, חדשני, חם, מקצועי)"),

  brandVoice: z
    .string()
    .describe(
      "קול המותג — כיצד המותג מדבר עם הלקוחות: טון, סגנון, מה אומרים ומה לא",
    ),

  colorPalette: z
    .array(
      z.object({
        name: z.string().describe("שם הצבע (לדוגמה: כחול ראשי, לבן רקע)"),
        hex: z.string().describe("קוד HEX של הצבע, לדוגמה: #2563EB"),
        usage: z.string().describe("שימוש עיקרי בצבע זה"),
      }),
    )
    .describe("פלטת צבעים של 4-5 צבעים"),

  typography: z.object({
    primary: z.object({
      font: z.string().describe("שם הפונט הראשי (Google Fonts)"),
      usage: z.string().describe("שימוש: כותרות, לוגו וכד'"),
    }),
    secondary: z.object({
      font: z.string().describe("שם הפונט המשני (Google Fonts)"),
      usage: z.string().describe("שימוש: גוף טקסט, תיאורים"),
    }),
  }),

  logoPrompt: z
    .string()
    .describe(
      "פרומפט באנגלית ליצירת לוגו עם AI (DALL-E / Midjourney) — תיאור מפורט של הסגנון, הצורה, הצבעים",
    ),
});

export type BrandingData = z.infer<typeof brandingSchema>;
