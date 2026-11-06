"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { getBusiness } from "@/lib/services/business.service";
import { getWebsite } from "@/lib/services/website.service";

/**
 * Toggles the storefront AI chat widget on/off for a business. Owner-guarded
 * via getBusiness (RLS backs this up too — the update below runs on the
 * user-scoped client).
 */
export async function toggleStoreChatAction(
  businessId: string,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  try {
    if (!(await getBusiness(businessId))) return { ok: false, error: "העסק לא נמצא" };

    const supabase = await createClient();
    const { error } = await supabase
      .from("businesses")
      .update({ store_chat_enabled: enabled })
      .eq("id", businessId);
    if (error) throw new Error(error.message);

    revalidatePath(`/businesses/${businessId}`);
    const website = await getWebsite(businessId).catch(() => null);
    if (website?.slug) revalidatePath(`/s/${website.slug}`);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "השמירה נכשלה" };
  }
}
