"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { createPartner, deletePartner } from "@/lib/services/partners.service";

export async function savePartnerAction(
  businessId: string,
  input: { name: string; logoUrl: string; link: string },
): Promise<{ error?: string }> {
  await requireUser();
  const name = input.name.trim();
  if (!name) return { error: "נא להזין שם שותף/לקוח" };

  const logoUrl = input.logoUrl.trim() || null;
  const link = input.link.trim() || null;

  const res = await createPartner(businessId, { name, logo_url: logoUrl, link });
  if (res.error) return res;
  revalidatePath(`/businesses/${businessId}/sections`);
  return {};
}

export async function deletePartnerAction(
  businessId: string,
  id: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await deletePartner(id);
    revalidatePath(`/businesses/${businessId}/sections`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}
