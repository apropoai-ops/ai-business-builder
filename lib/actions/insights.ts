"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { generateAndStoreInsights } from "@/lib/services/insights.service";
import { getPlanForBusiness } from "@/lib/quota";
import { assertFeature } from "@/lib/entitlements";

export async function refreshInsightsAction(
  businessId: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "ai_insights");
    await generateAndStoreInsights(businessId);
    revalidatePath(`/businesses/${businessId}/score`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "יצירת התובנות נכשלה" };
  }
}
