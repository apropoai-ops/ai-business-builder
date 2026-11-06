"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

/**
 * Sets (or clears) the business's announcement bar — a short marketing/announcement
 * message shown as a prominent top bar on the public site. Pass an empty string to
 * hide it. Capped at 160 chars.
 */
export async function setAnnouncementAction(
  businessId: string,
  text: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    const value = text.trim().slice(0, 160) || null;
    const supabase = await createClient();
    const { error } = await supabase
      .from("businesses")
      .update({ announcement_bar: value })
      .eq("id", businessId);
    if (error) throw new Error(error.message);
    revalidatePath(`/businesses/${businessId}/store`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "השמירה נכשלה" };
  }
}
