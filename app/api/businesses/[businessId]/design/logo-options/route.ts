import { NextResponse, type NextRequest } from "next/server";

import { getUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import { getBrandAssets } from "@/lib/services/branding.service";
import { designLogoSpec } from "@/lib/ai/agents/logo-design";
import { buildLogoSuite } from "@/lib/services/svg-design";
import { uploadSiteAsset } from "@/lib/services/image-gen";

// Vectors are drawn locally and the only network call is one small text
// completion, so this finishes in seconds rather than in the three minutes the
// image model needed.
export const maxDuration = 60;

/**
 * POST — three basic vector logo proposals built from the business name.
 *
 * This used to ask a text model to write three English prompts and then render
 * them on a paid image model. That cost money per click, took minutes, failed
 * often enough to need its own fallback path, produced raster files that blur
 * when scaled — and, the reason it had to go, image models cannot spell
 * Hebrew, so the owner's own business name came back as gibberish letterforms.
 *
 * Now a free text model picks the design direction and we draw the SVG. Free,
 * a few seconds, crisp at any size, correct Hebrew, and it cannot come back
 * empty: designLogoSpec falls back to the brand palette if the model is down.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Optional studio overrides for the business name + industry.
  let overrideName = "";
  let overrideIndustry = "";
  try {
    const body = await request.json();
    if (typeof body?.name === "string") overrideName = body.name.trim().slice(0, 80);
    if (typeof body?.industry === "string") overrideIndustry = body.industry.trim().slice(0, 80);
  } catch {
    // no/invalid body — fall back to the stored business details
  }

  try {
    const brand = await getBrandAssets(businessId);
    const palette =
      (brand?.color_palette as { hex: string }[] | null)
        ?.map((c) => c.hex)
        .filter((h) => /^#[0-9a-fA-F]{6}$/.test(h)) ?? [];
    const name = overrideName || brand?.brand_name || business.name || "עסק";
    const industry = overrideIndustry || business.industry || business.type || "כללי";

    const spec = await designLogoSpec({
      businessId,
      name,
      industry,
      description: business.description,
      palette,
      slogan: brand?.slogan ?? null,
    });

    const stamp = Date.now();
    const options = await Promise.all(
      buildLogoSuite(spec).map((variant) =>
        uploadSiteAsset(
          `${businessId}/logo-opt-${stamp}-${variant.key}.svg`,
          variant.svg,
          "image/svg+xml",
        ),
      ),
    );

    return NextResponse.json({ options });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "יצירת ההצעות נכשלה" },
      { status: 500 },
    );
  }
}
