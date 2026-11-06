import type {
  Business, BusinessProfile, MarketResearch,
  BrandAssets, CrmLead, CrmDeal, CrmTask,
} from "@/types/database";
import type { MarketResearchData } from "@/lib/ai/schemas/market-research";
import type { CeoSalesContext } from "@/lib/services/ceo-chat.service";
import { OWNER_CHAT_SCOPE } from "@/lib/ai/agents/scope";

/**
 * Builds a rich system prompt for the AI CEO by injecting all available
 * business context. The more features the user has generated, the smarter
 * the CEO becomes.
 *
 * `sales` is optional (fetched separately via
 * `getCeoSalesContext` in lib/services/ceo-chat.service.ts) — when provided,
 * the prompt gains a real "## נתוני מכירות" section with last-30-days
 * revenue, order/booking counts and top products.
 */
export function buildCeoSystemPrompt(ctx: {
  business: Business;
  profile: BusinessProfile | null;
  research: MarketResearch | null;
  brand: BrandAssets | null;
  leads: CrmLead[];
  deals: CrmDeal[];
  tasks: CrmTask[];
  sales?: CeoSalesContext | null;
}): string {
  const { business, profile, research, brand, leads, deals, tasks, sales } = ctx;

  const sections: string[] = [
    `אתה ה-AI CEO של העסק "${business.name ?? "העסק"}".
אתה יועץ עסקי אישי חכם, ישיר ומעשי. אתה מכיר את העסק לעומק ועונה בעברית תקנית.
תן תשובות ממוקדות, מעשיות ומבוססות נתונים — לא גנריות.

## כללי מענה (חובה)
- שורה תחתונה קודם: פתח כל תשובה במשפט אחד שעונה ישירות על השאלה, ורק אחר כך פרט.
- ענייני וכמותי: עגן כל המלצה בנתוני העסק שמופיעים למטה (הכנסות, לידים, עסקאות, מוצרים) עם המספרים עצמם. אם נתון לא קיים — אמור זאת, אל תמציא.
- מעשי: כל המלצה מסתיימת בפעולה קונקרטית שאפשר לבצע השבוע (מי, מה, עד מתי). לא "כדאי לשקול" — אלא "עשה X".
- תמציתי: 3-6 משפטים לשאלה פשוטה; לשאלה מורכבת עד 250 מילים עם מבנה. בלי מילות ריפוד, בלי חזרות, בלי הקדמות ("שאלה מצוינת!").

## עיצוב התשובה (Markdown)
- כתוב בעברית מימין לשמאל. אל תתחיל שורה במספר או במילה לועזית אם אפשר להימנע.
- לתשובה מורכבת השתמש במבנה: כותרות משנה קצרות (###), רשימות ממוספרות לצעדים, ותבליטים לנקודות. הדגש מספרים ומסקנות מפתח ב-**מודגש**.
- לתשובה קצרה — פסקה אחת נקייה, בלי כותרות מיותרות.
- אל תשתמש בטבלה אלא אם המשתמש ביקש השוואה.`,

    `## פרטי העסק
שם: ${business.name ?? "לא הוגדר"}
סוג: ${business.type ?? "—"}
תחום: ${business.industry ?? "—"}
מיקום: ${business.location ?? "—"}
קהל יעד: ${business.target_audience ?? "—"}
תיאור: ${business.description}`,
  ];

  if (profile?.executive_summary) {
    sections.push(`## תוכנית עסקית
תקציר: ${profile.executive_summary}
הצעת ערך: ${profile.value_proposition ?? "—"}`);
  }

  if (research) {
    const swot = research.swot as MarketResearchData["swot"] | null;
    const positioning = research.positioning;
    if (swot || positioning) {
      sections.push(`## מחקר שוק
מיצוב: ${positioning ?? "—"}
חוזקות: ${swot?.strengths?.join(", ") ?? "—"}
חולשות: ${swot?.weaknesses?.join(", ") ?? "—"}
הזדמנויות: ${swot?.opportunities?.join(", ") ?? "—"}
איומים: ${swot?.threats?.join(", ") ?? "—"}`);
    }
  }

  if (brand?.brand_name) {
    sections.push(`## מיתוג
שם מותג: ${brand.brand_name}
סלוגן: ${brand.slogan ?? "—"}
משימה: ${brand.mission ?? "—"}
קול מותג: ${brand.brand_voice ?? "—"}`);
  }

  if (sales) {
    const topProductsText =
      sales.topProducts.length > 0
        ? sales.topProducts.map((p) => `- ${p.name} (${p.qty} יח')`).join("\n")
        : "—";
    sections.push(`## נתוני מכירות (30 הימים האחרונים)
הכנסות מהזמנות ששולמו: ₪${sales.revenue30d.toLocaleString()}
מספר הזמנות ששולמו: ${sales.ordersCount30d}
מספר תורים/הזמנות שנקבעו: ${sales.bookingsCount30d}
מוצרים מובילים:
${topProductsText}`);
  }

  // CRM snapshot
  const openDeals = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const wonDeals = deals.filter((d) => d.stage === "won");
  const totalWon = wonDeals.reduce((s, d) => s + (d.value ?? 0), 0);
  const newLeads = leads.filter((l) => l.status === "new").length;
  const openTasks = tasks.filter((t) => !t.done).length;

  sections.push(`## נתוני CRM
לידים חדשים: ${newLeads} (סה"כ ${leads.length})
עסקאות פתוחות: ${openDeals.length}
עסקאות שנסגרו: ${wonDeals.length} (שווי: ₪${totalWon.toLocaleString()})
משימות פתוחות: ${openTasks}`);

  if (openDeals.length > 0) {
    sections.push(
      `עסקאות בצנרת:\n` +
      openDeals
        .slice(0, 5)
        .map((d) => `- ${d.title} (${d.stage}${d.value ? `, ₪${d.value.toLocaleString()}` : ""})`)
        .join("\n"),
    );
  }

  // Last, so it reads as the closing rule rather than as one section among
  // many — and so a long business context can never push it out of sight.
  sections.push(OWNER_CHAT_SCOPE);

  return sections.join("\n\n");
}
