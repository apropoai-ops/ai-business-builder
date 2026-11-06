"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { getBusiness } from "@/lib/services/business.service";
import { getWebsite } from "@/lib/services/website.service";
import { resolveSiteMode } from "@/lib/site-mode";
import {
  normalizeLandingSettings,
  type LandingSettingsInput,
} from "@/lib/landing-settings";
import type { LandingSettings } from "@/lib/ai/schemas/landing";
import type { Json } from "@/types/database";

/**
 * Saves the owner-controlled landing-page knobs onto `websites.landing_settings`.
 *
 * Ownership is enforced the same way as saveTrackingAction: requireUser() for a
 * session, getBusiness() through the RLS client so a stranger's businessId
 * simply doesn't resolve, and the UPDATE itself runs under RLS too. The mode
 * check is a product guard, not a security one — these fields only render on a
 * landing page, so writing them anywhere else would be a silent no-op.
 */
export async function saveLandingSettingsAction(
  businessId: string,
  input: LandingSettingsInput,
): Promise<{ ok: boolean; error?: string; saved?: LandingSettings }> {
  await requireUser();

  try {
    const business = await getBusiness(businessId);
    if (!business) return { ok: false, error: "העסק לא נמצא" };
    if (resolveSiteMode(business.site_mode) !== "landing") {
      return { ok: false, error: "ההגדרות האלה קיימות רק במצב דף נחיתה" };
    }

    const result = normalizeLandingSettings(input);
    if (!result.ok) return { ok: false, error: result.error };

    const supabase = await createClient();
    const { error } = await supabase
      .from("websites")
      // An interface has no index signature, so it needs a cast to satisfy Json.
      .update({ landing_settings: result.settings as unknown as Json })
      .eq("business_id", businessId);
    if (error) throw new Error(error.message);

    revalidatePath(`/businesses/${businessId}/website`);
    const website = await getWebsite(businessId).catch(() => null);
    if (website?.slug) revalidatePath(`/s/${website.slug}`, "layout");

    return { ok: true, saved: result.settings };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "השמירה נכשלה" };
  }
}
