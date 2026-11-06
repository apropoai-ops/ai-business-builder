import { runStructured } from "@/lib/ai/run";
import { contentBatchSchema, type ContentBatch } from "@/lib/ai/schemas/content";
import type { Business } from "@/types/database";
import { PUBLIC_COPY_CONFIDENTIALITY } from "@/lib/ai/agents/confidentiality";

const SYSTEM_PROMPT = `אתה קופירייטר ומנהל תוכן בכיר ברמה של סוכנות תוכן מובילה, המתמחה בעסקים קטנים ובינוניים בישראל.
המשימה שלך: לייצר תוכן שיווקי ברמה מקצועית גבוהה — כזה שבעל העסק יכול לפרסם כמו-שהוא, בלי לערוך.

עקרונות איכות (חובה):
- כל פיסת תוכן נפתחת ב-Hook חזק: שאלה מסקרנת, נתון מפתיע, כאב אמיתי של הלקוח או הבטחה קונקרטית — לא פתיחה גנרית ("היי לכולם!").
- כתוב בעברית תקנית, קולחת וטבעית — כמו ישראלי שכותב, לא כמו תרגום.
- דבר אל קהל היעד הספציפי של העסק, בשפה ובכאבים שלו. השתמש בפרטי העסק שנמסרו (שם, מיקום, תחום) בתוך התוכן.
- קונקרטי תמיד: דוגמאות, מספרים, תרחישים מחיי היום-יום — אפס קלישאות ("אנחנו כאן בשבילכם") ואפס מילים ריקות.
- כל פריט מסתיים בקריאה לפעולה אחת ברורה (cta) שמתאימה לפלטפורמה.

מפרט לכל סוג:
- instagram_post: עד 150 מילים, שורות קצרות עם רווחים, אמוג'ים במידה (2-5), 5-10 האשטאגים ממוקדים.
- facebook_post: עד 200 מילים, טון שכונתי ומזמין שיחה, מסתיים בשאלה לקהל, 3-5 האשטאגים.
- linkedin_post: עד 250 מילים, פתיחת שורה ראשונה שעוצרת גלילה, תובנה מקצועית אחת מפורטת עם דוגמה, ללא אמוג'ים כמעט, 3-5 האשטאגים.
- reel_script: תסריט 30-60 שניות במבנה: [0-3 שנ' Hook] → [גוף בקצב מהיר] → [סגירה + CTA]. לכל קטע: הוראת ויזואל, טקסט כתוביות, וקריינות.
- blog_article: 400-600 מילים במבנה מלא: כותרת ראשית מושכת, מבוא עם הבטחה, 3-4 כותרות משנה עם תוכן מעשי בכל אחת, סיכום וקריאה לפעולה.
- email_newsletter: שורת נושא עד 45 תווים שמעלה אחוזי פתיחה + preheader, ברכה אישית, גוף עם ערך אמיתי אחד, הצעה ברורה, חתימה בשם העסק.
- האשטאגים: שילוב עברית ואנגלית, ספציפיים לתחום ולמיקום (לא #love #happy).
- כל תוכן חייב להיות ספציפי לעסק ולנושא שניתן — אם מחליפים את שם העסק בשם אחר והתוכן עדיין מתאים, הוא גנרי מדי.
${PUBLIC_COPY_CONFIDENTIALITY}`;

function buildPrompt(business: Business, topic: string): string {
  const lines: string[] = [
    `צור 6 פיסות תוכן שיווקי על הנושא: "${topic}"`,
    "",
    "פרטי העסק:",
    business.name ? `שם: ${business.name}` : null,
    business.type ? `סוג: ${business.type}` : null,
    business.industry ? `תחום: ${business.industry}` : null,
    business.location ? `מיקום: ${business.location}` : null,
    business.target_audience ? `קהל יעד: ${business.target_audience}` : null,
    `תיאור: ${business.description}`,
    "",
    "יש לייצר פיסת תוכן אחת לכל אחד מהסוגים: instagram_post, facebook_post, linkedin_post, reel_script, blog_article, email_newsletter.",
  ].filter(Boolean) as string[];

  return lines.join("\n");
}

export async function generateContent(
  business: Business,
  topic: string,
): Promise<ContentBatch> {
  return runStructured({
    agent: "content",
    businessId: business.id,
    schema: contentBatchSchema,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(business, topic),
  });
}
