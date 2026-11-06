"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { createGalleryItem, deleteGalleryItem } from "@/lib/services/gallery.service";

export async function saveGalleryItemAction(
  businessId: string,
  input: { imageUrl: string; title?: string; caption?: string },
): Promise<{ error?: string }> {
  await requireUser();

  const imageUrl = input.imageUrl.trim();
  if (!imageUrl) return { error: "נא להעלות תמונה" };

  const res = await createGalleryItem(businessId, {
    image_url: imageUrl,
    title: input.title?.trim() || null,
    caption: input.caption?.trim() || null,
  });
  if (res.error) return res;
  revalidatePath(`/businesses/${businessId}/sections`);
  return {};
}

export async function deleteGalleryItemAction(
  businessId: string,
  id: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await deleteGalleryItem(id);
    revalidatePath(`/businesses/${businessId}/sections`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}
