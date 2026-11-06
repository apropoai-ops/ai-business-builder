import { z } from "zod";

export const contentTypeEnum = z.enum([
  "instagram_post",
  "facebook_post",
  "linkedin_post",
  "reel_script",
  "blog_article",
  "email_newsletter",
]);

export type ContentType = z.infer<typeof contentTypeEnum>;

export const contentTypeLabels: Record<ContentType, string> = {
  instagram_post: "פוסט אינסטגרם",
  facebook_post: "פוסט פייסבוק",
  linkedin_post: "פוסט לינקדאין",
  reel_script: "תסריט ריל",
  blog_article: "כתבת בלוג",
  email_newsletter: "ניוזלטר אימייל",
};

export const contentItemSchema = z.object({
  type: contentTypeEnum,
  title: z.string().describe("כותרת קצרה ומושכת לתוכן"),
  content: z.string().describe("גוף התוכן המלא, מותאם לפלטפורמה"),
  hashtags: z.array(z.string()).describe("האשטאגים ללא סימן # (בעברית ואנגלית)"),
  cta: z.string().optional().describe("קריאה לפעולה קצרה"),
});

export const contentBatchSchema = z.object({
  items: z
    .array(contentItemSchema)
    .min(1)
    .describe("רשימת פיסות תוכן לפלטפורמות שונות"),
});

export type ContentItem = z.infer<typeof contentItemSchema>;
export type ContentBatch = z.infer<typeof contentBatchSchema>;
