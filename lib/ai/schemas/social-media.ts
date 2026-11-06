import { z } from "zod";

export const socialPlatformEnum = z.enum([
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
]);
export type SocialPlatform = z.infer<typeof socialPlatformEnum>;

export const socialPlatformLabels: Record<SocialPlatform, string> = {
  instagram: "אינסטגרם",
  facebook: "פייסבוק",
  linkedin: "לינקדאין",
  tiktok: "טיקטוק",
};

export const socialPlatformProfileSchema = z.object({
  platform: socialPlatformEnum,
  bio: z.string().describe("ביו/תיאור פרופיל מומלץ לפלטפורמה (קצר ומושך)"),
  contentPillars: z
    .array(z.string())
    .describe("3-5 עמודי תוכן מרכזיים שסביבם לבנות את הנוכחות"),
  postingFrequency: z.string().describe("תדירות פרסום מומלצת (למשל: 4 פוסטים בשבוע)"),
  bestTimes: z
    .array(z.string())
    .describe("שעות/ימים מומלצים לפרסום בפלטפורמה זו"),
  hashtagSets: z
    .array(z.string())
    .describe("סט האשטאגים מומלצים (ללא #, בעברית ואנגלית)"),
  samplePosts: z
    .array(
      z.object({
        title: z.string().describe("רעיון/כותרת לפוסט"),
        body: z.string().describe("טיוטת הפוסט"),
      }),
    )
    .describe("2-3 פוסטים לדוגמה מותאמים לפלטפורמה"),
  growthTips: z
    .array(z.string())
    .describe("2-4 טיפים ספציפיים להגדלת הקהל בפלטפורמה זו"),
});

export const socialMediaStrategySchema = z.object({
  profiles: z
    .array(socialPlatformProfileSchema)
    .describe("אסטרטגיה לכל אחת מ-4 הפלטפורמות"),
});

export type SocialPlatformProfile = z.infer<typeof socialPlatformProfileSchema>;
export type SocialMediaStrategy = z.infer<typeof socialMediaStrategySchema>;
