"use server";

import { randomUUID } from "crypto";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import { createClient } from "@/lib/supabase/server";
import { deleteDownload } from "@/lib/services/downloads.service";

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-א-ת ]+/g, "_").slice(0, 150) || "file";
}

/**
 * Uploads a digital-download deliverable to the private 'business-files'
 * storage bucket (migration 0070), under a "<businessId>/downloads/" prefix.
 * Returns the storage path — the caller (saveDownloadAction) persists it on
 * the download row; public delivery goes through
 * app/api/downloads/[id]/route.ts, which mints a short-lived signed URL.
 */
export async function uploadDownloadFileAction(
  businessId: string,
  formData: FormData,
): Promise<{ error?: string; storagePath?: string }> {
  await requireUser();
  if (!(await getBusiness(businessId))) return { error: "העסק לא נמצא" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "נא לבחור קובץ" };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { error: "הקובץ גדול מדי (מקסימום 50MB)" };
  }

  try {
    const supabase = await createClient();
    const path = `${businessId}/downloads/${randomUUID()}-${sanitizeFileName(file.name)}`;
    const contentType = file.type || "application/octet-stream";
    // A Blob, never a raw Buffer — storage-js sends a Buffer as the bare
    // fetch body, which Vercel's runtime UTF-8-mangles (see uploadSiteAsset
    // in lib/services/image-gen.ts for the full story). A Blob takes the
    // multipart branch and stays byte-exact.
    const blob = new Blob([new Uint8Array(await file.arrayBuffer())], { type: contentType });
    const { error } = await supabase.storage
      .from("business-files")
      .upload(path, blob, { contentType, upsert: false });
    if (error) return { error: "ההעלאה נכשלה" };
    return { storagePath: path };
  } catch {
    return { error: "ההעלאה נכשלה" };
  }
}

export async function saveDownloadAction(
  businessId: string,
  input: {
    title: string;
    description: string;
    /** External file URL — fallback when no file was uploaded. */
    fileUrl: string;
    /** Storage path from uploadDownloadFileAction — takes priority over fileUrl. */
    storagePath?: string | null;
    price: string;
    imageUrl?: string | null;
  },
): Promise<{ error?: string }> {
  await requireUser();

  const title = input.title.trim();
  if (!title) return { error: "נא להזין כותרת" };

  const storagePath = input.storagePath?.trim() || null;
  const fileUrl = input.fileUrl.trim();
  if (!storagePath && !fileUrl) {
    return { error: "נא להעלות קובץ או להזין קישור לקובץ" };
  }
  // A storage path must live under THIS business's own upload folder — the
  // value comes from the client, so never let a crafted path point the
  // download row at another business's private file.
  if (storagePath && !storagePath.startsWith(`${businessId}/downloads/`)) {
    return { error: "נתיב קובץ לא תקין" };
  }
  if (fileUrl && !/^https?:\/\//i.test(fileUrl)) {
    return { error: "הקישור חייב להתחיל ב-http או https" };
  }

  const description = input.description.trim() || null;

  const price = input.price.trim() ? Number(input.price) : null;
  if (price !== null && (isNaN(price) || price < 0)) {
    return { error: "מחיר לא תקין" };
  }

  const imageUrl = input.imageUrl?.trim() || null;
  if (imageUrl && (!imageUrl.startsWith("https://") || imageUrl.length > 500)) {
    return { error: "כתובת תמונה לא תקינה" };
  }

  // Inserted directly (rather than via lib/services/downloads.service.ts,
  // owned by another package) so storage_path — added by migration 0070 —
  // can ride along on the same insert.
  const supabase = await createClient();
  const { error } = await supabase.from("downloads").insert({
    business_id: businessId,
    title,
    description,
    file_url: fileUrl || null,
    storage_path: storagePath,
    price,
    image_url: imageUrl,
  });
  if (error) return { error: error.message };

  revalidatePath(`/businesses/${businessId}/sections`);
  return {};
}

export async function deleteDownloadAction(
  businessId: string,
  id: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    // Best-effort: also remove the uploaded file from storage, if any.
    const supabase = await createClient();
    const { data: row } = await supabase
      .from("downloads")
      .select("storage_path")
      .eq("id", id)
      .maybeSingle();

    await deleteDownload(id);

    if (row?.storage_path) {
      await supabase.storage.from("business-files").remove([row.storage_path]);
    }

    revalidatePath(`/businesses/${businessId}/sections`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}
