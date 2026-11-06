"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import {
  createCertification,
  deleteCertification,
} from "@/lib/services/certifications.service";

export async function saveCertificationAction(
  businessId: string,
  input: { title: string; issuer: string; year: string; imageUrl: string },
): Promise<{ error?: string }> {
  await requireUser();

  const title = input.title.trim();
  if (!title) return { error: "נא להזין שם תעודה" };

  const issuer = input.issuer.trim() || null;
  const year = input.year.trim() || null;
  const imageUrl = input.imageUrl.trim() || null;

  const res = await createCertification(businessId, {
    title,
    issuer,
    year,
    image_url: imageUrl,
  });
  if (res.error) return res;

  revalidatePath(`/businesses/${businessId}/sections`);
  return {};
}

export async function deleteCertificationAction(
  businessId: string,
  id: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await deleteCertification(id);
    revalidatePath(`/businesses/${businessId}/sections`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}
