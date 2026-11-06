"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import { getWebsite, upsertWebsite } from "@/lib/services/website.service";
import { LAYOUT_KEYS, type SiteLayoutKey } from "@/lib/site-layout";

async function revalidateLayout(businessId: string) {
  revalidatePath(`/businesses/${businessId}/branding`);
  revalidatePath(`/businesses/${businessId}/website`);
  const website = await getWebsite(businessId).catch(() => null);
  if (website?.slug) revalidatePath(`/s/${website.slug}`);
}

/** Sets the storefront's full-site structural layout (one of the 5 built-in registry entries). */
export async function setLayoutStyleAction(
  businessId: string,
  style: string,
): Promise<{ error?: string }> {
  await requireUser();
  if (!(LAYOUT_KEYS as string[]).includes(style)) return { error: "מבנה לא תקין" };
  try {
    if (!(await getBusiness(businessId))) return { error: "העסק לא נמצא" };
    await upsertWebsite(businessId, { layout_style: style as SiteLayoutKey });
    await revalidateLayout(businessId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}
