"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import {
  createBeforeAfter,
  deleteBeforeAfter,
} from "@/lib/services/before-after.service";

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function saveBeforeAfterAction(
  businessId: string,
  input: { title: string; beforeUrl: string; afterUrl: string },
): Promise<{ error?: string }> {
  await requireUser();

  const beforeUrl = input.beforeUrl.trim();
  const afterUrl = input.afterUrl.trim();
  if (!beforeUrl || !afterUrl) return { error: "נא להזין קישור לתמונת לפני ולתמונת אחרי" };
  if (!isHttpUrl(beforeUrl)) return { error: "קישור תמונת ׳לפני׳ אינו תקין" };
  if (!isHttpUrl(afterUrl)) return { error: "קישור תמונת ׳אחרי׳ אינו תקין" };

  const title = input.title.trim() || null;

  const res = await createBeforeAfter(businessId, {
    title,
    before_url: beforeUrl,
    after_url: afterUrl,
  });
  if (res.error) return res;
  revalidatePath(`/businesses/${businessId}/sections`);
  return {};
}

export async function deleteBeforeAfterAction(
  businessId: string,
  id: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await deleteBeforeAfter(id);
    revalidatePath(`/businesses/${businessId}/sections`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}
