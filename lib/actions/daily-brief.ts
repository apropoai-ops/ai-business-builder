"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import { generateDailyBrief } from "@/lib/services/daily-brief.service";
import { getPlanForBusiness, UPGRADE_HINT } from "@/lib/quota";

/** On-demand brief regeneration from the overview page. */
export async function refreshDailyBriefAction(
  businessId: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    // RLS-scoped read proves ownership before the service-role generation.
    const business = await getBusiness(businessId);
    if (!business) return { error: "העסק לא נמצא" };

    // The daily brief is a PRO+ feature (cost gate).
    const plan = await getPlanForBusiness(businessId);
    if (!plan.dailyBrief) {
      return { error: `התדריך היומי זמין מתוכנית PRO ומעלה. ${UPGRADE_HINT}.` };
    }

    await generateDailyBrief(business, true);
    revalidatePath(`/businesses/${businessId}/overview`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "הפעולה נכשלה" };
  }
}
