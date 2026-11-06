"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { deleteHrRole } from "@/lib/services/hr.service";
import { getPlanForBusiness } from "@/lib/quota";
import { assertFeature } from "@/lib/entitlements";

export async function deleteHrRoleAction(
  businessId: string,
  roleId: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "hr");
    await deleteHrRole(roleId);
    revalidatePath(`/businesses/${businessId}/hr`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}
