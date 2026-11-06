"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  setReviewApproved,
  setReviewVerified,
  deleteReview,
  getBusinessSlug,
  createPublicReview,
} from "@/lib/services/reviews.service";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Refreshes the dashboard list + the public site (approved reviews shown there). */
async function revalidateReviewPaths(businessId: string): Promise<void> {
  revalidatePath(`/businesses/${businessId}/reviews`);
  const slug = await getBusinessSlug(businessId);
  if (slug) revalidatePath(`/s/${slug}`);
}

// ── Owner actions ───────────────────────────────────────────────────────────

/** Publish (approved=true) or hide (approved=false) a review. */
export async function approveReviewAction(
  businessId: string,
  reviewId: string,
  approved: boolean,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await setReviewApproved(reviewId, approved);
    await revalidateReviewPaths(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "הפעולה נכשלה" };
  }
}

/** Toggle the verified-purchase flag on a review. */
export async function verifyReviewAction(
  businessId: string,
  reviewId: string,
  verified: boolean,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await setReviewVerified(reviewId, verified);
    await revalidateReviewPaths(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "הפעולה נכשלה" };
  }
}

export async function deleteReviewAction(
  businessId: string,
  reviewId: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await deleteReview(reviewId);
    await revalidateReviewPaths(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}

// ── Public action (anonymous visitors on /s/[slug]) ────────────────────────

export async function submitReviewAction(
  slug: string,
  input: {
    name: string;
    rating: number;
    content: string;
    /** Optional customer photo (png/jpeg/webp, ≤4MB). */
    image?: File | null;
    /** Honeypot — hidden field; bots fill it, humans never see it. */
    company_website?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  // Honeypot tripped → pretend success, write nothing.
  if (input.company_website) return { ok: true };

  if (!(await checkRateLimit(`review:${slug}`, 10, 3600))) {
    return { ok: false, error: "יותר מדי ביקורות כרגע — נסו שוב מאוחר יותר" };
  }

  const name = input.name?.trim() ?? "";
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: "נא למלא שם (2–80 תווים)" };
  }
  const rating = input.rating;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "נא לבחור דירוג (1–5 כוכבים)" };
  }
  const content = input.content?.trim() ?? "";
  if (content.length < 5 || content.length > 600) {
    return { ok: false, error: "נא לכתוב ביקורת (5–600 תווים)" };
  }

  // Optional image — validate type + size before handing to the service.
  let image: File | null = null;
  if (input.image && input.image.size > 0) {
    if (!ALLOWED_IMAGE_TYPES.includes(input.image.type)) {
      return { ok: false, error: "תמונה בפורמט לא נתמך (PNG/JPEG/WEBP בלבד)" };
    }
    if (input.image.size > MAX_IMAGE_BYTES) {
      return { ok: false, error: "התמונה גדולה מדי (עד 4MB)" };
    }
    image = input.image;
  }

  return createPublicReview(slug, { name, rating, content, image });
}
