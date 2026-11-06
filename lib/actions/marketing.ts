"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { getWebsite } from "@/lib/services/website.service";

type Result = { ok: boolean; error?: string };

async function revalidateStore(businessId: string) {
  revalidatePath(`/businesses/${businessId}/store`);
  const website = await getWebsite(businessId).catch(() => null);
  if (website?.slug) revalidatePath(`/s/${website.slug}`);
}

export async function setPopupSettingsAction(
  businessId: string,
  input: { enabled: boolean; title: string; text: string; coupon: string },
): Promise<Result> {
  await requireUser();
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("businesses")
      .update({
        popup_enabled: input.enabled,
        popup_title: input.title.trim().slice(0, 80) || null,
        popup_text: input.text.trim().slice(0, 300) || null,
        popup_coupon: input.coupon.trim().toUpperCase().slice(0, 24) || null,
      })
      .eq("id", businessId);
    if (error) throw new Error(error.message);
    await revalidateStore(businessId);
    return { ok: true };
  } catch {
    return { ok: false, error: "השמירה נכשלה — נסו שוב" };
  }
}

export async function setReferralSettingsAction(
  businessId: string,
  input: { enabled: boolean; points: string },
): Promise<Result> {
  await requireUser();
  const points = Math.floor(Number(input.points));
  if (isNaN(points) || points < 0) return { ok: false, error: "נקודות תגמול לא תקין" };
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("businesses")
      .update({ referral_enabled: input.enabled, referral_points: points })
      .eq("id", businessId);
    if (error) throw new Error(error.message);
    await revalidateStore(businessId);
    return { ok: true };
  } catch {
    return { ok: false, error: "השמירה נכשלה — נסו שוב" };
  }
}

export async function setLoyaltySettingsAction(
  businessId: string,
  input: { enabled: boolean; earn: string; value: string },
): Promise<Result> {
  await requireUser();
  const earn = Number(input.earn);
  const value = Number(input.value);
  if (isNaN(earn) || earn < 0) return { ok: false, error: "נקודות לכל ₪ לא תקין" };
  if (isNaN(value) || value < 0) return { ok: false, error: "שווי נקודה לא תקין" };
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("businesses")
      .update({ loyalty_enabled: input.enabled, loyalty_earn: earn, loyalty_value: value })
      .eq("id", businessId);
    if (error) throw new Error(error.message);
    await revalidateStore(businessId);
    return { ok: true };
  } catch {
    return { ok: false, error: "השמירה נכשלה — נסו שוב" };
  }
}
