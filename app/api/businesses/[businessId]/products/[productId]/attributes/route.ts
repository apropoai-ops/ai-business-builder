import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import { createClient } from "@/lib/supabase/server";
import { updateProduct } from "@/lib/services/store.service";
import { runStructured } from "@/lib/ai/run";

export const maxDuration = 120;

const schema = z.object({
  fit: z.string().describe("גזרה, למשל: רגיל / אוברסייז / סלים / נוח"),
  fabric: z.string().describe("בד עיקרי, למשל: כותנה / פוליאסטר / דמוי עור"),
  season: z.string().describe("עונה: קיץ / חורף / מעבר / כל השנה"),
  gender: z.string().describe("מגדר: גברים / נשים / יוניסקס / ילדים"),
  collection: z.string().describe("קולקציה/סגנון, למשל: קז'ואל / ערב / ספורט / קלאסי"),
});

const SYSTEM = `אתה מרצ'נדייזר אופנה. מהשם והתיאור של מוצר, הסק את המאפיינים:
גזרה, בד, עונה, מגדר וקולקציה. ערכים קצרים בעברית. אם לא ברור — בחר את הסביר ביותר.`;

/** POST → infers fit/fabric/season/gender/collection and merges them as tags. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string; productId: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessId, productId } = await params;
  const business = await getBusiness(businessId);
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("name, description, full_description, tags")
    .eq("id", productId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!product) return NextResponse.json({ error: "המוצר לא נמצא" }, { status: 404 });

  try {
    const attrs = await runStructured({
      agent: "product_attributes",
      businessId,
      schema,
      system: SYSTEM,
      prompt: [
        `שם: ${product.name}`,
        product.description ? `תיאור: ${product.description}` : "",
        product.full_description ? `תיאור מלא: ${product.full_description}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });

    const newTags = [attrs.fit, attrs.fabric, attrs.season, attrs.gender, attrs.collection]
      .map((t) => t.trim())
      .filter(Boolean);
    const existing = Array.isArray(product.tags) ? (product.tags as string[]) : [];
    const merged = [...new Set([...existing, ...newTags])].slice(0, 16);

    await updateProduct(productId, { tags: merged });
    return NextResponse.json({ attributes: attrs, tags: merged });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "ניתוח המאפיינים נכשל" },
      { status: 500 },
    );
  }
}
