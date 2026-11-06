import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import { createProduct, updateProduct } from "@/lib/services/store.service";
import { runStructured } from "@/lib/ai/run";
import { generateProductPhoto } from "@/lib/services/product-photo";
import type { ProductColor } from "@/types/database";

// Structured generation + a best-effort photo generation afterward (which,
// worst case, retries Pollinations twice at ~55s each) can together exceed
// the previous 120s budget.
export const maxDuration = 180;

/** Allowed clothing colors → hex (the AI picks names from this set). */
const COLOR_HEX: Record<string, string> = {
  "שחור": "#000000",
  "לבן": "#FFFFFF",
  "אפור": "#9CA3AF",
  "כחול": "#2563EB",
  "נייבי": "#1E3A8A",
  "אדום": "#DC2626",
  "ירוק": "#16A34A",
  "בז'": "#D6BCA0",
  "חום": "#92400E",
  "ורוד": "#EC4899",
  "צהוב": "#FACC15",
  "סגול": "#7C3AED",
  "כתום": "#F97316",
};

const productSchema = z.object({
  title: z.string().describe("שם מוצר קצר, מושך ומדויק (עד 6 מילים)"),
  description: z.string().describe("תיאור מכירתי קולח, 2-4 משפטים, בעברית"),
  category: z
    .string()
    .describe("קטגוריה אחת בעברית: חולצות וטופים / מכנסיים וג׳ינסים / שמלות וחצאיות / נעליים ואקססוריז / הלבשה תחתונה / מעילים וג׳קטים"),
  tags: z.array(z.string()).min(3).max(8).describe("3-8 תגיות SEO בעברית"),
  colors: z
    .array(z.enum(Object.keys(COLOR_HEX) as [string, ...string[]]))
    .min(1)
    .max(5)
    .describe("צבעים מהרשימה המותרת בלבד"),
  sizes: z.array(z.string()).min(1).max(8).describe("מידות, למשל S,M,L,XL לבגד או 38-44 לנעליים"),
  suggestedPrice: z.number().positive().describe("מחיר מומלץ בשקלים — מספר בלבד"),
});

const SYSTEM = `אתה מנהל מרצ'נדייז ומעצב תוכן לחנות אופנה אונליין בישראל.
מהקלט (שם מוצר + פרטים אופציונליים) הפק כרטיס מוצר מלא, מקצועי ומוכר היטב.
- כתוב בעברית שיווקית, מדויקת, בלי הגזמות.
- בחר קטגוריה אחת מהרשימה, מידות הגיוניות לסוג הפריט, וצבעים מהרשימה המותרת בלבד.
- הצע מחיר ריאלי לשוק הישראלי בהתאם לסוג הפריט.`;

/** POST { name, details? } — generates a full product draft and creates it. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let name = "";
  let details = "";
  try {
    const body = await request.json();
    name = String(body?.name ?? "").trim().slice(0, 120);
    details = String(body?.details ?? "").trim().slice(0, 400);
  } catch {
    // bad body
  }
  if (name.length < 2) {
    return NextResponse.json({ error: "נא להזין שם מוצר" }, { status: 400 });
  }

  try {
    const draft = await runStructured({
      agent: "product_gen",
      businessId,
      schema: productSchema,
      system: SYSTEM,
      prompt: [
        `העסק: ${business.name ?? ""} — ${business.description.slice(0, 200)}`,
        `שם המוצר: ${name}`,
        details ? `פרטים נוספים: ${details}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });

    const colors: ProductColor[] = [...new Set(draft.colors)]
      .filter((c) => COLOR_HEX[c])
      .map((c) => ({ name: c, hex: COLOR_HEX[c] }));

    const product = await createProduct(businessId, {
      name: draft.title.slice(0, 120),
      description: draft.description.slice(0, 600),
      category: draft.category.slice(0, 60),
      price: Math.round(draft.suggestedPrice),
      sizes: [...new Set(draft.sizes.map((s) => s.trim()).filter(Boolean))].slice(0, 12),
      colors: colors.length ? colors : null,
      tags: [...new Set(draft.tags.map((t) => t.trim()).filter(Boolean))].slice(0, 8),
      in_stock: true,
      image_url: null,
    });

    // Best-effort — a realistic AI photo so the owner doesn't have to upload
    // one themselves. Rate-limit/quota exhaustion, or the provider failing,
    // must not fail product creation: the card just shows the placeholder
    // icon, and "תמונת AI"/manual upload are one click away.
    let image_url: string | null = null;
    try {
      image_url = await generateProductPhoto(businessId, product.id, {
        name: product.name,
        description: product.description,
        category: product.category,
        colors: colors.length ? colors : null,
      });
      await updateProduct(product.id, { image_url });
    } catch {
      // Swallowed — see comment above.
    }

    return NextResponse.json({ product: { ...product, image_url } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "יצירת המוצר נכשלה" },
      { status: 500 },
    );
  }
}
