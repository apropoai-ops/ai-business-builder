import { z } from "zod";

export const adPlatformEnum = z.enum(["meta", "google", "tiktok"]);
export type AdPlatform = z.infer<typeof adPlatformEnum>;

export const adPlatformLabels: Record<AdPlatform, string> = {
  meta: "Meta (פייסבוק + אינסטגרם)",
  google: "Google Ads",
  tiktok: "TikTok Ads",
};

export const adPlatformShortLabels: Record<AdPlatform, string> = {
  meta: "Meta",
  google: "Google",
  tiktok: "TikTok",
};

export const adCampaignPlanSchema = z.object({
  platform: adPlatformEnum,
  objective: z.string().describe("מטרת הקמפיין (למשל: לידים, מכירות, תנועה לאתר, מודעות)"),
  campaign: z
    .object({
      name: z.string().describe("שם קמפיין מוצע"),
      objective: z.string().describe("מטרת הקמפיין במונחי הפלטפורמה"),
      budgetSuggestion: z.string().describe("המלצת תקציב יומי/חודשי בשקלים, ריאלית לעסק"),
      bidStrategy: z.string().describe("אסטרטגיית הצעת מחיר מומלצת לפלטפורמה זו"),
    })
    .describe("מבנה הקמפיין"),
  audiences: z
    .array(
      z.object({
        name: z.string().describe("שם קהל היעד"),
        description: z.string().describe("מי הקהל ולמה הוא רלוונטי"),
        targeting: z
          .string()
          .describe(
            "הגדרות מיקוד קונקרטיות — לMeta/TikTok: גיל, מיקום, תחומי עניין; לGoogle: מילות מפתח/נושאים",
          ),
      }),
    )
    .describe("2-3 קהלי יעד מומלצים"),
  adCopies: z
    .array(
      z.object({
        headline: z.string().describe("כותרת המודעה"),
        body: z.string().describe("גוף המודעה / טקסט ראשי"),
        cta: z.string().describe("קריאה לפעולה"),
      }),
    )
    .describe("2-3 וריאציות של טקסט מודעה לבדיקת A/B"),
  creatives: z
    .array(
      z.object({
        concept: z.string().describe("רעיון הקריאייטיב"),
        format: z.string().describe("פורמט מומלץ (תמונה, וידאו קצר, קרוסלה וכו')"),
        visualIdea: z.string().describe("תיאור ויזואלי קונקרטי של המודעה"),
      }),
    )
    .describe("2-3 רעיונות קריאייטיב"),
});

export const adStrategySchema = z.object({
  campaigns: z
    .array(adCampaignPlanSchema)
    .describe("תוכנית פרסום לכל אחת מ-3 הפלטפורמות: meta, google, tiktok"),
});

export type AdCampaignPlan = z.infer<typeof adCampaignPlanSchema>;
export type AdStrategy = z.infer<typeof adStrategySchema>;
