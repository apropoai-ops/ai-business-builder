import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import { runStructured } from "@/lib/ai/run";

// AI marketing generation can take several seconds.
export const maxDuration = 120;

const marketingSchema = z.object({
  instagramCaption: z.string().describe("כיתוב אינסטגרם מושך ושיווקי בעברית, עם אימוג'ים מתאימים"),
  instagramHashtags: z
    .array(z.string())
    .min(3)
    .max(15)
    .describe("האשטגים רלוונטיים (בעברית ו/או אנגלית), כל אחד מתחיל ב-#"),
  facebookAd: z
    .object({
      headline: z.string().describe("כותרת מודעה קצרה וקליטה לפייסבוק"),
      body: z.string().describe("גוף מודעה שיווקי לפייסבוק, 2-4 משפטים, עם קריאה לפעולה"),
    })
    .describe("מודעת פייסבוק ממומנת"),
  marketingEmail: z
    .object({
      subject: z.string().describe("שורת נושא למייל שיווקי שמעודדת פתיחה"),
      body: z.string().describe("גוף מייל שיווקי בעברית, אישי וקולח, עם קריאה לפעולה"),
    })
    .describe("מייל שיווקי ללקוחות"),
  similarIdeas: z
    .array(z.string())
    .min(3)
    .max(8)
    .describe("רעיונות למוצרים דומים/משלימים שכדאי להוסיף לחנות"),
});

const SYSTEM = `אתה מנהל שיווק דיגיטלי ומומחה תוכן לרשתות חברתיות עבור חנויות אופנה אונליין בישראל.
מתוך פרטי העסק והמוצר, הפק חבילת שיווק מלאה ומקצועית:
- כיתוב אינסטגרם מושך עם אימוג'ים והאשטגים רלוונטיים.
- מודעת פייסבוק ממומנת (כותרת + גוף) עם קריאה ברורה לפעולה.
- מייל שיווקי (שורת נושא + גוף) אישי וקולח.
- רעיונות למוצרים דומים או משלימים שמתאימים לחנות.
כתוב הכל בעברית שיווקית, אותנטית, מותאמת לקהל הישראלי, בלי הגזמות.`;

/** POST — generates a full AI marketing pack for a single product. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; productId: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessId, productId } = await params;
  const business = await getBusiness(businessId);
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const s = (await import("@/lib/supabase/server")).createServiceRoleClient();
  const { data: product } = await s
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!product) {
    return NextResponse.json({ error: "המוצר לא נמצא" }, { status: 404 });
  }

  try {
    const marketing = await runStructured({
      agent: "product_marketing",
      businessId,
      schema: marketingSchema,
      system: SYSTEM,
      prompt: [
        `העסק: ${business.name ?? ""} — ${(business.description ?? "").slice(0, 200)}`,
        `שם המוצר: ${product.name ?? ""}`,
        product.description ? `תיאור המוצר: ${String(product.description).slice(0, 400)}` : "",
        product.category ? `קטגוריה: ${product.category}` : "",
        product.price != null ? `מחיר: ${product.price} ₪` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });

    return NextResponse.json({ marketing });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "יצירת חבילת השיווק נכשלה" },
      { status: 500 },
    );
  }
}
