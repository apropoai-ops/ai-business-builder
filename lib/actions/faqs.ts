"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { createFaq, deleteFaq, updateFaq } from "@/lib/services/faqs.service";

/**
 * Create or update a FAQ row. When `id` is supplied it updates, otherwise it
 * creates a new one. `question` is required; `answer` is optional.
 */
export async function saveFaqAction(
  businessId: string,
  input: {
    id?: string;
    question: string;
    answer: string;
    imageUrl?: string | null;
  },
): Promise<{ error?: string }> {
  await requireUser();

  const question = input.question.trim();
  if (!question) return { error: "נא להזין שאלה" };
  if (question.length > 300) return { error: "השאלה ארוכה מדי (עד 300 תווים)" };

  const answer = input.answer.trim() || null;

  const imageUrl = input.imageUrl?.trim() || null;
  if (imageUrl && (!imageUrl.startsWith("https://") || imageUrl.length > 500)) {
    return { error: "כתובת תמונה לא תקינה" };
  }

  const res = input.id
    ? await updateFaq(input.id, { question, answer, image_url: imageUrl })
    : await createFaq(businessId, { question, answer, image_url: imageUrl });

  if (res.error) return res;
  revalidatePath(`/businesses/${businessId}/content`);
  return {};
}

export async function deleteFaqAction(
  businessId: string,
  id: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await deleteFaq(id);
    revalidatePath(`/businesses/${businessId}/content`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}
