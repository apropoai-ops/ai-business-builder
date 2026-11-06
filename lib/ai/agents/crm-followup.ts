import { runStructured } from "@/lib/ai/run";
import { getBusiness } from "@/lib/services/business.service";
import { crmFollowupSchema, type CrmFollowup } from "@/lib/ai/schemas/crm-followup";

const SYSTEM_PROMPT = `אתה כותב הודעות מעקב קצרות, חמות ומקצועיות מטעם עסק קטן ללקוח או ליד, לשליחה בוואטסאפ (ולעיתים גם באימייל).

הנחיות:
- פתח בשם הפרטי של האדם.
- קריאה לפעולה ברורה אחת בלבד.
- לא יותר מ-60 מילים בהודעת הוואטסאפ.
- עברית ישראלית טבעית וידידותית.
- אמוג'ים במידה — לכל היותר אחד בהודעת הוואטסאפ (לא באימייל).
- הישען על ה"פעילות אחרונה" וההערות שסופקו בהקשר — התייחס אליהן במפורש כשרלוונטי, אל תתעלם מהן.
- לעולם אל תמציא מחירים או פרטים שלא ניתנו בהקשר.
- אל תישמע כמו בוט — כתוב כמו בעל עסק אמיתי שכותב הודעה אישית.
- אם התבקשת גם טיוטת אימייל — כתוב אותה בנימה מקצועית מעט יותר (עדיין חמה), עם כותרת קצרה. אם לא התבקשת, החזר email: null.`;

type DraftInput = {
  name: string;
  context: string;
  /** Present when the lead/customer has an email — signals the agent to also draft an email variant. */
  email?: string | null;
  /** Last ~5 timeline activities (notes/status/system), newest first — grounds the draft in real history. */
  recentActivity?: string[];
};

function buildPrompt(businessName: string, input: DraftInput): string {
  const lines = [
    `שם העסק: ${businessName}`,
    `שם הלקוח/ליד: ${input.name}`,
    `הקשר: ${input.context}`,
  ];

  if (input.recentActivity && input.recentActivity.length > 0) {
    lines.push("", "פעילות אחרונה (מהחדש לישן):");
    for (const item of input.recentActivity) lines.push(`- ${item}`);
  }

  lines.push("", "כתוב הודעת מעקב קצרה לשליחה בוואטסאפ.");
  if (input.email) {
    lines.push(`ללקוח/ליד יש גם כתובת אימייל — כתוב גם טיוטת אימייל מקבילה (כותרת + גוף).`);
  } else {
    lines.push("אין כתובת אימייל ידועה — החזר email: null.");
  }

  return lines.join("\n");
}

/** Drafts a short WhatsApp (and optionally email) follow-up message for a CRM lead/customer. */
export async function draftCrmFollowup(
  businessId: string,
  input: DraftInput,
): Promise<CrmFollowup> {
  const business = await getBusiness(businessId);
  const businessName = business?.name ?? "העסק";

  return runStructured({
    agent: "crm_followup",
    businessId,
    schema: crmFollowupSchema,
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(businessName, input),
  });
}
