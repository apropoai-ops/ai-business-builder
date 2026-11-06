"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { createJob, deleteJob, setJobActive } from "@/lib/services/jobs.service";

// ── Owner actions ───────────────────────────────────────────────────────────

export async function saveJobAction(
  businessId: string,
  input: {
    title: string;
    location: string;
    employmentType: string;
    description: string;
    imageUrl?: string | null;
  },
): Promise<{ error?: string }> {
  await requireUser();
  const title = input.title.trim();
  if (!title) return { error: "נא להזין כותרת משרה" };

  const imageUrl = input.imageUrl?.trim() || null;
  if (imageUrl && (!imageUrl.startsWith("https://") || imageUrl.length > 500)) {
    return { error: "כתובת תמונה לא תקינה" };
  }

  const res = await createJob(businessId, {
    title,
    location: input.location.trim() || null,
    employment_type: input.employmentType.trim() || null,
    description: input.description.trim() || null,
    image_url: imageUrl,
  });
  if (res.error) return res;
  revalidatePath(`/businesses/${businessId}/content`);
  return {};
}

export async function deleteJobAction(
  businessId: string,
  id: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await deleteJob(id);
    revalidatePath(`/businesses/${businessId}/content`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}

export async function toggleJobAction(
  businessId: string,
  id: string,
  active: boolean,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await setJobActive(id, active);
    revalidatePath(`/businesses/${businessId}/content`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}
