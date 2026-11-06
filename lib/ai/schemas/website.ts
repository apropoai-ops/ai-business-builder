import { z } from "zod";

const ctaSchema = z.object({
  text: z.string().describe("טקסט הכפתור"),
  href: z.string().describe("קישור (/#contact, /#services וכד')"),
});

export const websiteSchema = z.object({
  home: z.object({
    hero: z.object({
      headline: z.string().describe("כותרת ראשית — מושכת תשומת לב, עד 10 מילים"),
      subheadline: z.string().describe("תת-כותרת — מסביר את הצעת הערך, 1-2 משפטים"),
      cta: ctaSchema,
    }),
    benefits: z
      .array(
        z.object({
          title: z.string(),
          description: z.string(),
        }),
      )
      .describe("3 יתרונות/ערכים מרכזיים של העסק"),
    socialProof: z
      .string()
      .describe("משפט מחזק אמינות — מספרים, ניסיון, תעודות או המלצה לדוגמה"),
  }),

  about: z.object({
    headline: z.string().describe("כותרת דף אודות"),
    story: z.string().describe("סיפור העסק — 2-3 פסקאות בגוף ראשון"),
    values: z
      .array(
        z.object({
          title: z.string(),
          description: z.string(),
        }),
      )
      .describe("3-4 ערכי ליבה של העסק"),
    teamNote: z.string().describe("משפט על הצוות/המייסד"),
  }),

  services: z.object({
    headline: z.string().describe("כותרת דף שירותים"),
    intro: z.string().describe("משפט פתיחה לדף השירותים"),
    items: z
      .array(
        z.object({
          name: z.string().describe("שם השירות"),
          description: z.string().describe("תיאור השירות — 2-3 משפטים"),
          price: z.string().nullable().describe("מחיר או טווח מחירים (אופציונלי)"),
          features: z.array(z.string()).describe("3-5 תכונות/כלולות"),
        }),
      )
      .describe("3-5 שירותים/מוצרים מרכזיים"),
  }),

  contact: z.object({
    headline: z.string().describe("כותרת דף צור קשר"),
    intro: z.string().describe("טקסט מזמין ליצירת קשר"),
    formFields: z
      .array(z.string())
      .describe("שדות הטופס (שם, טלפון, אימייל, הודעה...)"),
    responseTime: z.string().describe("זמן מענה מובטח"),
  }),

  faq: z.object({
    headline: z.string().describe("כותרת דף שאלות נפוצות"),
    items: z
      .array(
        z.object({
          question: z.string(),
          answer: z.string(),
        }),
      )
      .describe("6-8 שאלות ותשובות נפוצות"),
  }),

  seoMeta: z.object({
    title: z.string().describe("כותרת SEO לדף הבית (עד 60 תווים)"),
    description: z
      .string()
      .describe("תיאור מטא לדף הבית (עד 160 תווים)"),
    keywords: z.array(z.string()).describe("5-8 מילות מפתח"),
  }),
});

export type WebsiteData = z.infer<typeof websiteSchema>;
