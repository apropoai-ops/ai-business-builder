import { runStructured } from "@/lib/ai/run";
import { insightsSchema, type Insights } from "@/lib/ai/schemas/insights";
import type { Business } from "@/types/database";
import type { BusinessScore, ScoreMetrics } from "@/lib/business-score";

const SYSTEM_PROMPT = `אתה יועץ עסקי בכיר ואנליסט נתונים, מומחה לעסקים קטנים בישראל.
על סמך הציון העסקי והנתונים שתקבל, ספק ניתוח חד וקונקרטי + המלצות מתועדפות.

הנחיות:
- כתוב הכול בעברית, ישיר וענייני — בלי סיסמאות ובלי מילוי מקום.
- בסס כל קביעה על הנתונים שניתנו (ציין מספרים רלוונטיים).
- התמקד בצמיחה, סיכוני נטישה, הכנסות והמרת לידים.
- ההמלצות חייבות להיות צעדים שאפשר לבצע השבוע, מתועדפות לפי השפעה.`;

function buildPrompt(business: Business, score: BusinessScore, m: ScoreMetrics): string {
  const dims = score.dimensions.map((d) => `${d.label}: ${d.score}/100`).join(", ");
  return [
    `העסק: ${business.name ?? "ללא שם"} (${business.industry ?? business.type ?? "כללי"})`,
    `תיאור: ${business.description.slice(0, 200)}`,
    "",
    `ציון עסקי כולל: ${score.overall}/100`,
    `ציון לפי תחום: ${dims}`,
    "",
    "נתונים:",
    `- לקוחות: ${m.customers} | לידים: ${m.leadsTotal} (מתוכם ${m.leadsConverted} הומרו)`,
    `- הכנסות (עסקאות שנסגרו + הצעות שאושרו): ₪${Math.round(m.revenue)} | בצנרת: ₪${Math.round(m.pipelineValue)}`,
    `- הזמנות שאושרו: ${m.ordersConfirmed} | הצעות מחיר שאושרו: ${m.acceptedQuotes}`,
    `- תוכן שנוצר: ${m.contentCount} | פרופילי רשתות: ${m.socialProfiles} | קמפיינים: ${m.adsCampaigns} | ביקורים באתר (30 יום): ${m.visits30d}`,
    `- משימות: ${m.tasksDone} הושלמו, ${m.tasksOpen} פתוחות | תורים: ${m.bookings}`,
    `- ביקורות: ${m.reviewsCount} (דירוג ממוצע ${m.avgRating.toFixed(1)}) | תגובות וואטסאפ: ${m.whatsappReplies}`,
    `- אתר פעיל: ${m.sitePublished ? "כן" : "לא"} | לינק תשלום: ${m.hasPaymentLink ? "כן" : "לא"}`,
  ].join("\n");
}

export async function generateInsights(
  business: Business,
  score: BusinessScore,
  metrics: ScoreMetrics,
): Promise<Insights> {
  return runStructured({
    agent: "business_insights",
    businessId: business.id,
    schema: insightsSchema,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(business, score, metrics),
  });
}
