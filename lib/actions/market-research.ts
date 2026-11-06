"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { createJob } from "@/lib/services/job.service";

/**
 * Queues a fresh market-research generation and revalidates the page.
 */
export async function regenerateMarketResearchAction(
  businessId: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await createJob(businessId, "market_research");
    revalidatePath(`/businesses/${businessId}/research`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "הפעולה נכשלה" };
  }
}
