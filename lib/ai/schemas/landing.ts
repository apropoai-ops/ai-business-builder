import { z } from "zod";

/**
 * The landing page's ELEVEN sections, in the fixed order the spec mandates:
 *   hero → בעיה → פתרון → יתרונות → למי מתאים → תמונות → סרטון → ביקורות →
 *   FAQ → CTA → טופס
 *
 * The order is structural, not data: the renderer lays these out in exactly
 * this sequence, so there is no `sort` anywhere here. Every field is copy the
 * AI writes; owner-supplied media (image URLs, the video link) and the
 * countdown live in `websites.landing_settings`, not in this schema.
 *
 * Item counts are kept deliberately tight — a landing page converts on
 * focus, and a smaller output is also a safer output-token budget.
 */

const titledPoints = z.array(
  z.object({
    title: z.string().describe("כותרת קצרה — עד 6 מילים"),
    description: z.string().describe("משפט או שניים, קונקרטי ולא גנרי"),
  }),
);

export const landingSchema = z.object({
  hero: z.object({
    badge: z
      .string()
      .describe("שורת אמון קצרה מעל הכותרת — מספר לקוחות, ותק או הישג. עד 6 מילים"),
    headline: z
      .string()
      .describe("ההבטחה המרכזית — התוצאה שהלקוח מקבל, לא תיאור המוצר. עד 10 מילים"),
    subheadline: z.string().describe("משפט אחד שמסביר איך ולמי. עד 25 מילים"),
    ctaText: z.string().describe("טקסט הכפתור הראשי — פעולה בגוף ראשון"),
  }),

  problem: z.object({
    headline: z.string().describe("כותרת סקשן הבעיה — מנסחת את הכאב במילים של הלקוח"),
    intro: z.string().describe("פסקה קצרה שמחדדת את המצב היום"),
    points: titledPoints.describe("3 כאבים ספציפיים שהלקוח מזהה בעצמו"),
  }),

  solution: z.object({
    headline: z.string().describe("כותרת הפתרון — מה משתנה"),
    intro: z.string().describe("פסקה קצרה שמסבירה את השיטה"),
    points: titledPoints.describe("3 שלבים או מרכיבים של הפתרון"),
  }),

  benefits: z.object({
    headline: z.string().describe("כותרת סקשן היתרונות"),
    items: titledPoints.describe("4 יתרונות — תוצאות ללקוח, לא תכונות מוצר"),
  }),

  audience: z.object({
    headline: z.string().describe("כותרת 'למי זה מתאים'"),
    fits: z.array(z.string()).describe("4 משפטי 'זה בשבילך אם…'"),
    notFits: z.array(z.string()).describe("2 משפטי 'זה לא בשבילך אם…' — בונה אמון"),
  }),

  gallery: z.object({
    headline: z.string().describe("כותרת סקשן התמונות"),
    intro: z.string().describe("משפט מלווה קצר"),
    captions: z.array(z.string()).describe("3 כיתובים לתמונות שהבעלים יעלה"),
  }),

  video: z.object({
    headline: z.string().describe("כותרת סקשן הסרטון"),
    intro: z.string().describe("משפט שמסביר מה רואים בסרטון ולמה כדאי לצפות"),
  }),

  testimonials: z.object({
    headline: z.string().describe("כותרת סקשן הביקורות"),
    items: z
      .array(
        z.object({
          name: z.string().describe("שם פרטי ואות ראשונה של משפחה"),
          role: z.string().describe("תפקיד או הקשר — נותן אמינות"),
          quote: z.string().describe("ציטוט עם תוצאה קונקרטית, לא סופרלטיבים"),
        }),
      )
      .describe("3 המלצות לדוגמה שהבעלים יחליף בהמלצות אמיתיות"),
  }),

  faq: z.object({
    headline: z.string().describe("כותרת השאלות הנפוצות"),
    items: z
      .array(
        z.object({
          question: z.string(),
          answer: z.string(),
        }),
      )
      .describe("5 שאלות שמסירות התנגדויות קנייה אמיתיות (מחיר, זמן, סיכון, התאמה)"),
  }),

  cta: z.object({
    headline: z.string().describe("קריאה לפעולה סופית — חדה ומחייבת"),
    subheadline: z.string().describe("משפט שמסיר את הסיכון האחרון"),
    buttonText: z.string().describe("טקסט הכפתור"),
    urgency: z
      .string()
      .describe("שורת דחיפות אמיתית לצד הטיימר — מקומות/זמן מוגבל. בלי הגזמות"),
  }),

  form: z.object({
    headline: z.string().describe("כותרת הטופס"),
    intro: z.string().describe("משפט שמסביר מה קורה אחרי השליחה"),
    buttonText: z.string().describe("טקסט כפתור השליחה"),
    successMessage: z.string().describe("הודעת התודה אחרי שליחה מוצלחת"),
    privacyNote: z.string().describe("משפט הרגעה קצר על פרטיות ואי-ספאם"),
  }),

  seoMeta: z.object({
    title: z.string().describe("כותרת SEO (עד 60 תווים)"),
    description: z.string().describe("תיאור מטא (עד 160 תווים)"),
    keywords: z.array(z.string()).describe("5-8 מילות מפתח"),
  }),
});

export type LandingData = z.infer<typeof landingSchema>;

/** Owner-controlled knobs stored on `websites.landing_settings`. */
export interface LandingSettings {
  countdownEnabled?: boolean;
  /** ISO timestamp the countdown counts down to. */
  countdownEndsAt?: string | null;
  countdownLabel?: string | null;
  /** YouTube/Vimeo URL for the video section; the section hides when empty. */
  videoUrl?: string | null;
  /** Image URLs for the gallery section; the section hides when empty. */
  galleryUrls?: string[];
}

/** Safe read of the jsonb column — never throws on junk. */
export function parseLandingSettings(value: unknown): LandingSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const v = value as Record<string, unknown>;
  return {
    countdownEnabled: v.countdownEnabled === true,
    countdownEndsAt: typeof v.countdownEndsAt === "string" ? v.countdownEndsAt : null,
    countdownLabel: typeof v.countdownLabel === "string" ? v.countdownLabel : null,
    videoUrl: typeof v.videoUrl === "string" ? v.videoUrl : null,
    galleryUrls: Array.isArray(v.galleryUrls)
      ? v.galleryUrls.filter((u): u is string => typeof u === "string")
      : [],
  };
}
