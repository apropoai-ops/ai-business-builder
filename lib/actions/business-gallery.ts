"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { getBusiness, uploadGalleryImage, deleteGalleryImage } from "@/lib/services/business.service";

/**
 * Uploads one or more photos to a business's general gallery — reachable the
 * moment an owner opens an existing business (design tab), mirroring the
 * validation `saveProductAction` applies to product images (lib/actions/store.ts).
 */
export async function uploadGalleryImagesAction(
  businessId: string,
  formData: FormData,
): Promise<{ error?: string; urls?: string[] }> {
  await requireUser();
  try {
    const business = await getBusiness(businessId);
    if (!business) return { error: "העסק לא נמצא" };

    const files = formData
      .getAll("images")
      .filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return { error: "לא נבחרו תמונות" };

    const urls: string[] = [];
    for (const file of files) {
      if (file.size > 4 * 1024 * 1024) return { error: "כל תמונה עד 4MB" };
      if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return { error: "פורמט תמונה לא נתמך" };
      urls.push(await uploadGalleryImage(businessId, file));
    }

    revalidatePath(`/businesses/${businessId}/website`);
    revalidatePath(`/businesses/${businessId}/sections`);
    return { urls };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "העלאת התמונות נכשלה" };
  }
}

export async function deleteGalleryImageAction(
  businessId: string,
  url: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    const business = await getBusiness(businessId);
    if (!business) return { error: "העסק לא נמצא" };

    await deleteGalleryImage(businessId, url);
    revalidatePath(`/businesses/${businessId}/website`);
    revalidatePath(`/businesses/${businessId}/sections`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "מחיקת התמונה נכשלה" };
  }
}
