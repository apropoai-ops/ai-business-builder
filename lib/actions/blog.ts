"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import {
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  setBlogPublished,
} from "@/lib/services/blog.service";

function revalidateContent(businessId: string) {
  revalidatePath(`/businesses/${businessId}/content`);
  revalidatePath(`/businesses/${businessId}/sections`);
}

/**
 * Create or update a blog post. When `input.id` is supplied it updates the
 * existing row (re-slugging only if the title changed), otherwise it creates
 * a new one.
 */
export async function saveBlogPostAction(
  businessId: string,
  input: {
    id?: string;
    title: string;
    excerpt?: string;
    body?: string;
    coverUrl?: string;
    published?: boolean;
  },
): Promise<{ error?: string }> {
  await requireUser();
  const title = input.title.trim();
  if (!title) return { error: "נא להזין כותרת" };
  if (title.length > 200) return { error: "הכותרת ארוכה מדי (עד 200 תווים)" };

  const fields = {
    title,
    excerpt: input.excerpt?.trim() || null,
    body: input.body?.trim() || null,
    cover_url: input.coverUrl?.trim() || null,
    published: Boolean(input.published),
  };

  const res = input.id
    ? await updateBlogPost(businessId, input.id, fields)
    : await createBlogPost(businessId, fields);
  if (res.error) return res;
  revalidateContent(businessId);
  return {};
}

export async function deleteBlogPostAction(
  businessId: string,
  id: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await deleteBlogPost(id);
    revalidateContent(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}

export async function togglePublishAction(
  businessId: string,
  id: string,
  published: boolean,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await setBlogPublished(id, published);
    revalidateContent(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}
