import { runStructured } from "@/lib/ai/run";
import { websiteSchema, type WebsiteData } from "@/lib/ai/schemas/website";
import {
  PUBLIC_COPY_CONFIDENTIALITY,
  findInternalLeaks,
} from "@/lib/ai/agents/confidentiality";
import type { Business } from "@/types/database";

const SYSTEM_PROMPT = `אתה כותב תוכן דיגיטלי בכיר המתמחה בבניית אתרי עסקים בישראל.
המשימה שלך: לכתוב תוכן מלא לאתר עסקי — מושך, ממוקד ומותאם SEO.

הנחיות:
- כתוב הכול בעברית תקנית, שיווקית וברורה.
- הכותרות חייבות להיות חדות ומושכות — לא גנריות.
- סיפור העסק חייב להיות אנושי ואמיתי, לא שיווקי-מדי.
- מחירים — אם לא ידועים, השאר null.
- שאלות נפוצות צריכות לענות על חששות אמיתיים של לקוחות.
- SEO: כותרת ותיאור חייבים להכיל את שם העסק ומילות מפתח.
${PUBLIC_COPY_CONFIDENTIALITY}`;

function buildPrompt(business: Business): string {
  return [
    "להלן פרטי העסק. כתוב תוכן מלא לאתר שלו:",
    "",
    business.name ? `שם העסק: ${business.name}` : null,
    business.type ? `סוג העסק: ${business.type}` : null,
    business.industry ? `תחום/ענף: ${business.industry}` : null,
    business.location ? `מיקום: ${business.location}` : null,
    business.target_audience ? `קהל יעד: ${business.target_audience}` : null,
    "",
    `תיאור: ${business.description}`,
  ]
    .filter(Boolean)
    .join("\n") as string;
}

export async function generateWebsite(business: Business): Promise<WebsiteData> {
  const call = (correction?: string) =>
    runStructured({
      agent: "website",
      businessId: business.id,
      schema: websiteSchema,
      system: correction ? `${SYSTEM_PROMPT}\n${correction}` : SYSTEM_PROMPT,
      prompt: buildPrompt(business),
    });

  const draft = await call();
  const leaks = findInternalLeaks(JSON.stringify(draft));
  if (leaks.length === 0) return draft;

  // This copy goes live on a paying customer's storefront without anyone
  // reading it first, so a prompt rule alone isn't enough — when the tripwire
  // fires we re-run once, naming exactly what slipped through. If the second
  // pass still trips, we return it anyway: a slightly leaky page beats no page.
  return call(
    `\nהניסיון הקודם הפר את כלל הסודיות והכיל את הביטויים: ${leaks.join(" | ")}.` +
      ` כתוב את כל התוכן מחדש בלי הביטויים האלה ובלי שום רמז אליהם.`,
  );
}
