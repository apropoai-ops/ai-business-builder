"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { getWebsite } from "@/lib/services/website.service";
import type { Json } from "@/types/database";

export type SizeGuide = {
  headers: string[];
  rows: { size: string; cells: string[] }[];
};

/**
 * Sets (or clears) the business's size guide (טבלת מידות). Pass `null` to clear.
 * The chart is shown to customers behind a "טבלת מידות" button on the public store.
 */
export async function setSizeGuideAction(
  businessId: string,
  guide: SizeGuide | null,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("businesses")
      .update({ size_guide: guide as unknown as Json })
      .eq("id", businessId);
    if (error) throw new Error(error.message);

    revalidatePath(`/businesses/${businessId}/store`);
    const website = await getWebsite(businessId).catch(() => null);
    if (website?.slug) revalidatePath(`/s/${website.slug}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "השמירה נכשלה" };
  }
}
