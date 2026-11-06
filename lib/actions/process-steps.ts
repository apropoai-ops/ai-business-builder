"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import {
  createProcessStep,
  deleteProcessStep,
} from "@/lib/services/process-steps.service";

export async function saveProcessStepAction(
  businessId: string,
  input: { title: string; description: string; imageUrl?: string | null },
): Promise<{ error?: string }> {
  await requireUser();
  const title = input.title.trim();
  if (!title) return { error: "יש להזין כותרת לשלב" };
  if (title.length > 120) return { error: "הכותרת ארוכה מדי (עד 120 תווים)" };
  const description = input.description.trim() || null;

  const imageUrl = input.imageUrl?.trim() || null;
  if (imageUrl && (!imageUrl.startsWith("https://") || imageUrl.length > 500)) {
    return { error: "כתובת תמונה לא תקינה" };
  }

  const res = await createProcessStep(businessId, {
    title,
    description,
    image_url: imageUrl,
  });
  if (res.error) return res;
  revalidatePath(`/businesses/${businessId}/sections`);
  return {};
}

export async function deleteProcessStepAction(
  businessId: string,
  id: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await deleteProcessStep(id);
    revalidatePath(`/businesses/${businessId}/sections`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}
