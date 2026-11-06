"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { createStat, deleteStat } from "@/lib/services/stats.service";

export async function saveStatAction(
  businessId: string,
  input: { label: string; value: string; suffix: string; imageUrl?: string | null },
): Promise<{ error?: string }> {
  await requireUser();

  const label = input.label.trim();
  const value = input.value.trim();
  if (!label) return { error: "נא להזין כותרת" };
  if (!value) return { error: "נא להזין ערך" };
  const suffix = input.suffix.trim() || null;

  const imageUrl = input.imageUrl?.trim() || null;
  if (imageUrl && (!imageUrl.startsWith("https://") || imageUrl.length > 500)) {
    return { error: "כתובת תמונה לא תקינה" };
  }

  const res = await createStat(businessId, {
    label,
    value,
    suffix,
    image_url: imageUrl,
  });
  if (res.error) return res;
  revalidatePath(`/businesses/${businessId}/sections`);
  return {};
}

export async function deleteStatAction(
  businessId: string,
  id: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await deleteStat(id);
    revalidatePath(`/businesses/${businessId}/sections`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}
