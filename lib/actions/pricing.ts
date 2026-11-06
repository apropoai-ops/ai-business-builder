"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import {
  createPricingPlan,
  deletePricingPlan,
} from "@/lib/services/pricing.service";

export async function savePricingPlanAction(
  businessId: string,
  input: {
    name: string;
    price: string;
    period: string;
    features: string[];
    highlight: boolean;
    imageUrl?: string | null;
  },
): Promise<{ error?: string }> {
  await requireUser();

  const name = input.name.trim();
  if (!name) return { error: "נא להזין שם חבילה" };

  let price: number | null = null;
  const rawPrice = input.price.trim();
  if (rawPrice) {
    const n = Number(rawPrice);
    if (!Number.isFinite(n) || n < 0) return { error: "מחיר לא תקין" };
    price = n;
  }

  const period = input.period.trim() || null;
  const features = (input.features ?? [])
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  const imageUrl = input.imageUrl?.trim() || null;
  if (imageUrl && (!imageUrl.startsWith("https://") || imageUrl.length > 500)) {
    return { error: "כתובת תמונה לא תקינה" };
  }

  const res = await createPricingPlan(businessId, {
    name,
    price,
    period,
    features,
    highlight: Boolean(input.highlight),
    imageUrl,
  });
  if (res.error) return res;

  revalidatePath(`/businesses/${businessId}/content`);
  return {};
}

export async function deletePricingPlanAction(
  businessId: string,
  id: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await deletePricingPlan(id);
    revalidatePath(`/businesses/${businessId}/content`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}
