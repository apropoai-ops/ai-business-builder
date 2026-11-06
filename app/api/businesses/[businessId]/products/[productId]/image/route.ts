import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import { getBrandAssets } from "@/lib/services/branding.service";
import { updateProduct, listProducts } from "@/lib/services/store.service";
import { runStructured } from "@/lib/ai/run";
import { uploadSiteAsset } from "@/lib/services/image-gen";
import { sanitizeSvg } from "@/lib/services/svg-design";

export const maxDuration = 120;

const imgSchema = z.object({
  svg: z.string().describe("קוד SVG מלא, viewBox 0 0 400 300"),
});

const SYSTEM = `אתה מאייר מוצרים בסגנון flat-design מודרני לחנויות אונליין.
צייר איור SVG של המוצר.

חוקים מחייבים:
- viewBox="0 0 400 300", ללא script/אירועים/תמונות חיצוניות, ללא <text>.
- סגנון flat נקי עם עומק עדין (צללים כ-shapes שקופים). עד 18 צורות.
- רקע מלבן מלא בגוון רך נגזר מצבעי המותג.
- האיור ממורכז, ברור, ומזוהה עם המוצר.`;

/** POST — AI-illustrated product image (vector, zero image-API cost). */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string; productId: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessId, productId } = await params;
  const business = await getBusiness(businessId);
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // RLS-scoped list confirms the product belongs to this owner.
  const product = (await listProducts(businessId)).find((p) => p.id === productId);
  if (!product) return NextResponse.json({ error: "המוצר לא נמצא" }, { status: 404 });

  try {
    const brand = await getBrandAssets(businessId);
    const palette =
      (brand?.color_palette as { hex: string }[] | null)
        ?.map((c) => c.hex)
        .filter((h) => /^#[0-9a-fA-F]{6}$/.test(h)) ?? [];

    const result = await runStructured({
      agent: "product_image",
      businessId,
      schema: imgSchema,
      system: SYSTEM,
      prompt: [
        `צייר את המוצר: "${product.name}"`,
        product.description ? `תיאור: ${product.description.slice(0, 200)}` : "",
        `תחום העסק: ${business.industry ?? business.type ?? "כללי"}`,
        `צבעי המותג: ${palette.slice(0, 4).join(", ") || "#2563EB"}`,
      ].filter(Boolean).join("\n"),
    });

    const svg = sanitizeSvg(result.svg);
    if (!svg) return NextResponse.json({ error: "האיור שנוצר לא תקין — נסו שוב" }, { status: 500 });

    const url = await uploadSiteAsset(
      `${businessId}/products/${productId}-ai.svg`,
      svg,
      "image/svg+xml",
    );
    await updateProduct(productId, { image_url: url });

    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "יצירת התמונה נכשלה" },
      { status: 500 },
    );
  }
}
