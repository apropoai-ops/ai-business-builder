import { generateImage, uploadSiteAsset } from "@/lib/services/image-gen";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertAiGenerationQuota, recordAiGeneration, assertUnderCostCap, addAiCost } from "@/lib/quota";
import type { ProductColor } from "@/types/database";

// Rough gpt-image-1 1024x1024 estimate — only ever charged on the paid
// fallback (Gemini/Pollinations, tried first, are free). Best-effort like
// every other addAiCost call in the codebase.
const OPENAI_IMAGE_COST_USD = 0.04;

/**
 * Builds a photoreal product-photography prompt from the product's own
 * fields — an English template (image models read it far more reliably than
 * Hebrew) wrapping whatever Hebrew name/description the owner entered.
 */
export function buildProductPhotoPrompt(input: {
  name: string;
  description?: string | null;
  category?: string | null;
  brand?: string | null;
  colors?: ProductColor[] | null;
}): string {
  return [
    `Professional e-commerce product photography of: ${input.name}.`,
    input.description ?? "",
    input.category ? `Product category: ${input.category}.` : "",
    input.brand ? `Brand: ${input.brand}.` : "",
    input.colors?.length ? `Color: ${input.colors.map((c) => c.name).join(", ")}.` : "",
    "The product fills the frame, centered, on a plain seamless white studio " +
      "background, soft even studio lighting, sharp focus, realistic, high " +
      "detail. No text, no watermark, no logo, no people, no hands, no props.",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Generates a realistic product photo (as opposed to the flat-SVG
 * illustration in app/api/.../products/[productId]/image/route.ts) and
 * uploads it to site-assets. Shares the same hourly rate-limit key and
 * quota/cost-cap gate as every other AI generation (lib/ai/run.ts) so this
 * doesn't open a separate, uncapped spending channel.
 */
export async function generateProductPhoto(
  businessId: string,
  productId: string,
  input: Parameters<typeof buildProductPhotoPrompt>[0],
): Promise<string> {
  const allowed = await checkRateLimit(`ai_gen:${businessId}`, 20, 3600);
  if (!allowed) throw new Error("חרגתם ממכסת ייצור ה-AI לשעה זו — נסו שוב בעוד כשעה");
  await assertUnderCostCap(businessId);
  await assertAiGenerationQuota(businessId);

  const { buffer, provider } = await generateImage(buildProductPhotoPrompt(input), "1024x1024");
  const url = await uploadSiteAsset(`${businessId}/products/${productId}-ai-photo.png`, buffer, "image/png");

  await recordAiGeneration(businessId);
  if (provider === "openai") await addAiCost(businessId, OPENAI_IMAGE_COST_USD);

  return url;
}
