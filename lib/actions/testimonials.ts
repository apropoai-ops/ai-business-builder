"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import {
  createTestimonial,
  deleteTestimonial,
} from "@/lib/services/testimonials.service";

export async function saveTestimonialAction(
  businessId: string,
  input: {
    author: string;
    role: string;
    quote: string;
    photoUrl: string;
    rating: string;
  },
): Promise<{ error?: string }> {
  await requireUser();

  const author = input.author.trim();
  const quote = input.quote.trim();
  if (!author) return { error: "נא להזין שם ממליץ" };
  if (!quote) return { error: "נא להזין את תוכן ההמלצה" };

  const role = input.role.trim() || null;
  const photoUrl = input.photoUrl.trim() || null;

  let rating: number | null = null;
  if (input.rating.trim()) {
    const r = Math.floor(Number(input.rating));
    if (isNaN(r) || r < 1 || r > 5) return { error: "דירוג חייב להיות בין 1 ל-5" };
    rating = r;
  }

  const res = await createTestimonial(businessId, {
    author,
    role,
    quote,
    photo_url: photoUrl,
    rating,
  });
  if (res.error) return res;
  revalidatePath(`/businesses/${businessId}/content`);
  return {};
}

export async function deleteTestimonialAction(
  businessId: string,
  id: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await deleteTestimonial(id);
    revalidatePath(`/businesses/${businessId}/content`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}
