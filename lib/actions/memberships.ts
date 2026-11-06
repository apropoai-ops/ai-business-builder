"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import {
  createMembership,
  deleteMembership,
} from "@/lib/services/memberships.service";

export async function saveMembershipAction(
  businessId: string,
  input: {
    name: string;
    price: string;
    period: string;
    perks: string[];
    highlight: boolean;
    imageUrl?: string | null;
  },
): Promise<{ error?: string }> {
  await requireUser();

  const name = input.name.trim();
  if (!name) return { error: "נא להזין שם מסלול" };

  let price: number | null = null;
  const rawPrice = input.price.trim();
  if (rawPrice) {
    const n = Number(rawPrice);
    if (!Number.isFinite(n) || n < 0) return { error: "מחיר לא תקין" };
    price = n;
  }

  const period = input.period.trim() || null;
  const perks = (input.perks ?? [])
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const imageUrl = input.imageUrl?.trim() || null;
  if (imageUrl && (!imageUrl.startsWith("https://") || imageUrl.length > 500)) {
    return { error: "כתובת תמונה לא תקינה" };
  }

  const res = await createMembership(businessId, {
    name,
    price,
    period,
    perks,
    highlight: Boolean(input.highlight),
    imageUrl,
  });
  if (res.error) return res;

  revalidatePath(`/businesses/${businessId}/sections`);
  return {};
}

export async function deleteMembershipAction(
  businessId: string,
  id: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await deleteMembership(id);
    revalidatePath(`/businesses/${businessId}/sections`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}
