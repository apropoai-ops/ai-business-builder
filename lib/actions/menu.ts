"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { createMenuItem, deleteMenuItem } from "@/lib/services/menu.service";

export async function saveMenuItemAction(
  businessId: string,
  input: {
    section: string;
    name: string;
    description: string;
    price: string;
    imageUrl: string;
  },
): Promise<{ error?: string }> {
  await requireUser();

  const name = input.name.trim();
  if (!name) return { error: "שם הפריט הוא שדה חובה" };

  const section = input.section.trim() || null;
  const description = input.description.trim() || null;
  const imageUrl = input.imageUrl.trim() || null;

  let price: number | null = null;
  if (input.price.trim()) {
    price = Number(input.price);
    if (isNaN(price) || price < 0) return { error: "מחיר לא תקין" };
  }

  const res = await createMenuItem(businessId, {
    section,
    name,
    description,
    price,
    image_url: imageUrl,
  });
  if (res.error) return res;

  revalidatePath(`/businesses/${businessId}/content`);
  return {};
}

export async function deleteMenuItemAction(
  businessId: string,
  id: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await deleteMenuItem(id);
    revalidatePath(`/businesses/${businessId}/content`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}
