"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { createBranch, deleteBranch } from "@/lib/services/branches.service";

export async function saveBranchAction(
  businessId: string,
  input: {
    name: string;
    address: string;
    phone: string;
    hours: string;
    mapUrl: string;
    imageUrl?: string | null;
  },
): Promise<{ error?: string }> {
  await requireUser();

  const name = input.name.trim();
  if (!name) return { error: "נא להזין שם סניף" };

  const imageUrl = input.imageUrl?.trim() || null;
  if (imageUrl && (!imageUrl.startsWith("https://") || imageUrl.length > 500)) {
    return { error: "כתובת תמונה לא תקינה" };
  }

  const res = await createBranch(businessId, {
    name,
    address: input.address.trim() || null,
    phone: input.phone.trim() || null,
    hours: input.hours.trim() || null,
    map_url: input.mapUrl.trim() || null,
    image_url: imageUrl,
  });
  if (res.error) return res;

  revalidatePath(`/businesses/${businessId}/sections`);
  return {};
}

export async function deleteBranchAction(
  businessId: string,
  id: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await deleteBranch(id);
    revalidatePath(`/businesses/${businessId}/sections`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}
