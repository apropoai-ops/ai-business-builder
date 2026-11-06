"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import {
  createCourse,
  deleteCourse,
  setCourseActive,
} from "@/lib/services/courses.service";

export async function saveCourseAction(
  businessId: string,
  input: {
    title: string;
    description: string;
    price: string;
    level: string;
    duration: string;
    imageUrl: string;
  },
): Promise<{ error?: string }> {
  await requireUser();

  const title = input.title.trim();
  if (!title) return { error: "שם הקורס הוא שדה חובה" };

  const description = input.description.trim() || null;
  const level = input.level.trim() || null;
  const duration = input.duration.trim() || null;
  const imageUrl = input.imageUrl.trim() || null;

  let price: number | null = null;
  if (input.price.trim()) {
    price = Number(input.price);
    if (isNaN(price) || price < 0) return { error: "מחיר לא תקין" };
  }

  const res = await createCourse(businessId, {
    title,
    description,
    price,
    level,
    duration,
    image_url: imageUrl,
  });
  if (res.error) return res;

  revalidatePath(`/businesses/${businessId}/sections`);
  return {};
}

export async function deleteCourseAction(
  businessId: string,
  id: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await deleteCourse(id);
    revalidatePath(`/businesses/${businessId}/sections`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}

export async function toggleCourseAction(
  businessId: string,
  id: string,
  active: boolean,
): Promise<{ error?: string }> {
  await requireUser();
  const res = await setCourseActive(id, active);
  if (res.error) return res;
  revalidatePath(`/businesses/${businessId}/sections`);
  return {};
}
