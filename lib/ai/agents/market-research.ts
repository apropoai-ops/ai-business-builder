import { runStructured } from "@/lib/ai/run";
import {
  marketResearchSchema,
  type MarketResearchData,
} from "@/lib/ai/schemas/market-research";
import type { Business } from "@/types/database";

const SYSTEM_PROMPT = `אתה אנליסט שוק בכיר המתמחה בשוק הישראלי ובעסקים קטנים ובינוניים.
המשימה שלך: לנתח את השוק עבור עסק ולהפיק מחקר שוק מקצועי, ריאליסטי ומעשי.

הנחיות:
- כתוב הכול בעברית תקנית וברורה.
- זהה מתחרים אמיתיים ורלוונטיים לשוק הישראלי.
- ה-SWOT צריך להיות ספציפי לעסק ולתחום, לא גנרי.
- הזדמנויות השוק חייבות להיות מעשיות וניתנות ליישום.
- המיצוב המומלץ צריך להיות מובחן וברור — מה שגורם ללקוח לבחור דווקא בעסק הזה.`;

function buildPrompt(business: Business): string {
  const lines: string[] = [
    "להלן פרטי העסק. הפק עבורו מחקר שוק מלא:",
    "",
    business.name ? `שם העסק: ${business.name}` : null,
    business.type ? `סוג העסק: ${business.type}` : null,
    business.industry ? `תחום/ענף: ${business.industry}` : null,
    business.location ? `מיקום: ${business.location}` : null,
    business.target_audience ? `קהל יעד: ${business.target_audience}` : null,
    "",
    `תיאור הרעיון: ${business.description}`,
  ].filter(Boolean) as string[];

  return lines.join("\n");
}

export async function generateMarketResearch(
  business: Business,
): Promise<MarketResearchData> {
  return runStructured({
    agent: "market_research",
    businessId: business.id,
    schema: marketResearchSchema,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(business),
  });
}
