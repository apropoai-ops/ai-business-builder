"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/user";
import { createJob } from "@/lib/services/job.service";
import { getBusiness } from "@/lib/services/business.service";
import {
  getWebsite,
  setWebsitePublishState,
  upsertWebsite,
} from "@/lib/services/website.service";
import { websiteSchema, type WebsiteData } from "@/lib/ai/schemas/website";
import { checkPublishQuota, getPlanForBusiness } from "@/lib/quota";
import { planAllowsSiteMode, siteModeUpgradeMessage } from "@/lib/entitlements";
import { resolveSiteMode } from "@/lib/site-mode";
import type { Json } from "@/types/database";

/** Saves manually-edited website content. Validates each page against the schema. */
export async function updateWebsiteContentAction(
  businessId: string,
  content: WebsiteData,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    const parsed = websiteSchema.safeParse(content);
    if (!parsed.success) {
      return { error: "תוכן לא תקין — בדקו שכל השדות מלאים" };
    }

    await upsertWebsite(businessId, {
      page_home: parsed.data.home as unknown as Json,
      page_about: parsed.data.about as unknown as Json,
      page_services: parsed.data.services as unknown as Json,
      page_contact: parsed.data.contact as unknown as Json,
      page_faq: parsed.data.faq as unknown as Json,
      seo_meta: parsed.data.seoMeta as unknown as Json,
    });

    revalidatePath(`/businesses/${businessId}/website`);
    const website = await getWebsite(businessId);
    if (website?.slug) revalidatePath(`/s/${website.slug}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "השמירה נכשלה" };
  }
}

/** Builds a URL-safe slug from the business name + a short random suffix. */
function buildSlug(name: string | null): string {
  const base = (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  const suffix = Math.random().toString(36).slice(2, 6);
  return base.length >= 3 ? `${base}-${suffix}` : `site-${suffix}`;
}

export async function publishWebsiteAction(
  businessId: string,
  publish: boolean,
  customSlug?: string,
): Promise<{ error?: string; slug?: string }> {
  const { user } = await requireUser();
  if (publish) {
    const quotaError = await checkPublishQuota(user.id);
    if (quotaError) return { error: quotaError };

    // The real paywall for the three products. The free trial can build a
    // store and the wizard/mode switcher stay permissive, so this is the one
    // place a mode the customer hasn't paid for is stopped from going live.
    // Unpublishing is never blocked — you can always take your own site down.
    const business = await getBusiness(businessId);
    const mode = resolveSiteMode(business?.site_mode);
    const plan = await getPlanForBusiness(businessId);
    if (!planAllowsSiteMode(plan, mode)) {
      return { error: siteModeUpgradeMessage(mode) };
    }
  }
  try {
    const website = await getWebsite(businessId);
    if (!website?.generated_at) {
      return { error: "צרו את האתר לפני הפרסום" };
    }

    let slug = customSlug?.trim() || website.slug || null;
    if (publish && !slug) {
      const business = await getBusiness(businessId);
      slug = buildSlug(business?.name ?? null);
    }
    if (slug && !/^[a-z0-9-]{3,60}$/.test(slug)) {
      return { error: "כתובת לא תקינה — אותיות באנגלית, מספרים ומקפים בלבד (3-60 תווים)" };
    }

    await setWebsitePublishState(businessId, {
      ...(slug ? { slug } : {}),
      published: publish,
    });
    revalidatePath(`/businesses/${businessId}/website`);
    if (slug) revalidatePath(`/s/${slug}`);
    return { slug: slug ?? undefined };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "הפעולה נכשלה" };
  }
}

export async function regenerateWebsiteAction(
  businessId: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await createJob(businessId, "website");
    revalidatePath(`/businesses/${businessId}/website`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "הפעולה נכשלה" };
  }
}
