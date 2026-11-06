"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { deleteContentItem } from "@/lib/services/content.service";
import { getPlanForBusiness } from "@/lib/quota";
import { assertFeature } from "@/lib/entitlements";

export async function deleteContentItemAction(
  businessId: string,
  itemId: string,
): Promise<void> {
  await requireUser();
  const plan = await getPlanForBusiness(businessId);
  assertFeature(plan, "content_engine");
  await deleteContentItem(itemId);
  revalidatePath(`/businesses/${businessId}/content`);
}
