"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { createJob } from "@/lib/services/job.service";

export async function regenerateBrandingAction(
  businessId: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await createJob(businessId, "branding");
    revalidatePath(`/businesses/${businessId}/branding`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "הפעולה נכשלה" };
  }
}
