import { NextResponse, type NextRequest } from "next/server";

import { getUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import { updateProduct, listProducts } from "@/lib/services/store.service";
import { generateProductPhoto } from "@/lib/services/product-photo";

// image-gen.ts's Pollinations retry budget alone is ~116s worst case.
export const maxDuration = 150;

/**
 * POST — AI-generated realistic product photo (as opposed to the flat-SVG
 * illustration at .../image/route.ts). Sibling endpoint, same ownership
 * check, so an owner can pick either style per product.
 */
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
    const url = await generateProductPhoto(businessId, productId, {
      name: product.name,
      description: product.full_description ?? product.description,
      category: product.category,
      brand: product.brand,
      colors: product.colors,
    });
    await updateProduct(productId, { image_url: url });
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "יצירת התמונה נכשלה" },
      { status: 500 },
    );
  }
}
