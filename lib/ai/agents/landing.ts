import { runStructured } from "@/lib/ai/run";
import { landingSchema, type LandingData } from "@/lib/ai/schemas/landing";
import {
  PUBLIC_COPY_CONFIDENTIALITY,
  findInternalLeaks,
} from "@/lib/ai/agents/confidentiality";
import type { Business } from "@/types/database";

/**
 * The landing-page copywriter. Deliberately a DIFFERENT agent from `website`:
 * a brochure site informs, a landing page sells, and the same prompt cannot do
 * both well. The eleven sections and their order come from the schema.
 */
const SYSTEM_PROMPT = `אתה קופירייטר בכיר של דפי נחיתה בישראל, עם התמחות בהמרות מקמפיינים ממומנים.
המשימה: לכתוב את כל הטקסטים לדף נחיתה אחד שמטרתו היחידה היא להביא את הגולש לפעולה.

כללי כתיבה:
- עברית טבעית ומדוברת, לא עברית שיווקית-מנופחת. כותבים כמו שמדברים ללקוח אחד.
- מדברים בשפת הלקוח על הבעיה שלו — לא בשפת העסק על עצמו.
- כל טענה קונקרטית: מספרים, זמנים, תוצאות. אפס סופרלטיבים ריקים ("הטוב ביותר", "מוביל בתחום", "פורץ דרך").
- הכותרת הראשית מבטיחה תוצאה ללקוח, לא מתארת את המוצר.
- היתרונות הם מה שהלקוח מקבל, לא מה שהמוצר עושה.
- השאלות הנפוצות מסירות התנגדויות קנייה אמיתיות: מחיר, זמן, סיכון, "זה יעבוד גם בשבילי?".
- ההמלצות הן דוגמאות שהבעלים יחליף — כתוב אותן אמינות ומדודות, עם תוצאה אחת ברורה, לא נלהבות מדי.
- שורת הדחיפות חייבת להיות אמיתית וניתנת לקיום (מקומות מוגבלים / מחיר עד תאריך). אסור לשקר.
- אם המחיר ידוע — שלב אותו בטקסט. אם לא — כתוב סביב הערך ולא סביב המחיר.
- אורך: קצר וחד. משפטים קצרים. בלי פסקאות ארוכות.
${PUBLIC_COPY_CONFIDENTIALITY}`;

function buildPrompt(business: Business): string {
  return [
    "להלן הבריף. כתוב את כל הטקסטים לדף הנחיתה:",
    "",
    business.name ? `שם העסק: ${business.name}` : null,
    business.industry ? `תחום/ענף: ${business.industry}` : null,
    business.location ? `מיקום: ${business.location}` : null,
    business.target_audience ? `קהל יעד: ${business.target_audience}` : null,
    "",
    `תיאור והבריף המלא: ${business.description}`,
  ]
    .filter(Boolean)
    .join("\n") as string;
}

export async function generateLanding(business: Business): Promise<LandingData> {
  const call = (correction?: string) =>
    runStructured({
      agent: "landing",
      businessId: business.id,
      schema: landingSchema,
      system: correction ? `${SYSTEM_PROMPT}\n${correction}` : SYSTEM_PROMPT,
      prompt: buildPrompt(business),
    });

  const draft = await call();
  const leaks = findInternalLeaks(JSON.stringify(draft));
  if (leaks.length === 0) return draft;

  // Same tripwire as the website agent — see lib/ai/agents/confidentiality.ts.
  return call(
    `\nהניסיון הקודם הפר את כלל הסודיות והכיל את הביטויים: ${leaks.join(" | ")}.` +
      ` כתוב את כל התוכן מחדש בלי הביטויים האלה ובלי שום רמז אליהם.`,
  );
}
