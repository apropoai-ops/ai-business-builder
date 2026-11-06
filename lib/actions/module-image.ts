"use server";

import { randomUUID } from "crypto";

import { requireUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import { uploadSiteAsset } from "@/lib/services/image-gen";

function validImage(file: unknown): file is File {
  return (
    file instanceof File &&
    file.size > 0 &&
    file.size <= 12 * 1024 * 1024 && // 12MB — phone photos are often 5-12MB
    /^image\/(png|jpe?g|webp)$/.test(file.type)
  );
}

/**
 * Generic image upload for storefront module content (menu items, events,
 * pricing plans, branches…). Returns the public CDN URL; the caller saves it
 * on the relevant content row.
 */
export async function uploadModuleImageAction(
  businessId: string,
  formData: FormData,
): Promise<{ error?: string; url?: string }> {
  await requireUser();
  try {
    if (!(await getBusiness(businessId))) return { error: "העסק לא נמצא" };
    const file = formData.get("file");
    if (!validImage(file)) {
      return { error: "קובץ לא תקין (PNG/JPG/WebP עד 12MB)" };
    }
    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
    const url = await uploadSiteAsset(
      `${businessId}/modules/${randomUUID()}.${ext}`,
      Buffer.from(await file.arrayBuffer()),
      file.type,
    );
    return { url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "ההעלאה נכשלה" };
  }
}
