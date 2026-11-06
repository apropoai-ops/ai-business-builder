"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import {
  createDonation,
  deleteDonation,
  setDonationActive,
} from "@/lib/services/donations.service";

// ── Owner actions ───────────────────────────────────────────────────────────

export async function saveDonationAction(
  businessId: string,
  input: {
    title: string;
    description: string;
    goalAmount: string;
    raisedAmount: string;
    imageUrl?: string | null;
  },
): Promise<{ error?: string }> {
  await requireUser();

  const title = input.title.trim();
  if (!title) return { error: "נא להזין כותרת לקמפיין" };

  const description = input.description.trim() || null;

  const goalAmount = input.goalAmount.trim() ? Number(input.goalAmount) : null;
  if (goalAmount !== null && (isNaN(goalAmount) || goalAmount < 0)) {
    return { error: "יעד תרומה לא תקין" };
  }

  const raisedAmount = input.raisedAmount.trim() ? Number(input.raisedAmount) : 0;
  if (isNaN(raisedAmount) || raisedAmount < 0) {
    return { error: "סכום שנאסף לא תקין" };
  }

  const imageUrl = input.imageUrl?.trim() || null;
  if (imageUrl && (!imageUrl.startsWith("https://") || imageUrl.length > 500)) {
    return { error: "כתובת תמונה לא תקינה" };
  }

  const res = await createDonation(businessId, {
    title,
    description,
    goal_amount: goalAmount,
    raised_amount: raisedAmount,
    image_url: imageUrl,
  });
  if (res.error) return res;
  revalidatePath(`/businesses/${businessId}/sections`);
  return {};
}

export async function deleteDonationAction(
  businessId: string,
  id: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await deleteDonation(id);
    revalidatePath(`/businesses/${businessId}/sections`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}

export async function toggleDonationAction(
  businessId: string,
  id: string,
  active: boolean,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await setDonationActive(id, active);
    revalidatePath(`/businesses/${businessId}/sections`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}
