"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import { createClient } from "@/lib/supabase/server";
import {
  saveIntegrationCredentials,
  disconnectIntegration,
  type IntegrationCategory,
} from "@/lib/services/integrations/credentials";

/**
 * Server actions for the integrations hub (/integrations) — generic
 * connect/disconnect for the credentials store (business_integrations) plus
 * the small per-business email sender settings. Ownership is enforced by
 * getBusiness, which reads through the RLS-scoped client and returns null
 * for a business the caller doesn't own.
 */

type Result = { ok: boolean; error?: string };

function revalidateIntegrations(businessId: string) {
  revalidatePath(`/businesses/${businessId}/integrations`);
}

async function verifyOwnership(businessId: string) {
  await requireUser();
  const business = await getBusiness(businessId);
  if (!business) throw new Error("העסק לא נמצא");
  return business;
}

/** Saves (upserts) a provider connection under the given category. */
export async function saveIntegrationAction(
  businessId: string,
  provider: string,
  category: IntegrationCategory,
  credentials: Record<string, string>,
): Promise<Result> {
  try {
    await verifyOwnership(businessId);
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(credentials)) {
      const v = (value ?? "").toString().trim();
      if (v) clean[key] = v;
    }
    await saveIntegrationCredentials(businessId, provider, category, clean);
    revalidateIntegrations(businessId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "השמירה נכשלה" };
  }
}

export async function disconnectIntegrationAction(
  businessId: string,
  provider: string,
): Promise<Result> {
  try {
    await verifyOwnership(businessId);
    await disconnectIntegration(businessId, provider);
    revalidateIntegrations(businessId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "הניתוק נכשל" };
  }
}

/** Saves the "אימייל" card's From display name + Reply-To settings. */
export async function saveEmailSettingsAction(
  businessId: string,
  data: { emailFromName: string; emailReplyTo: string },
): Promise<Result> {
  try {
    await verifyOwnership(businessId);
    const supabase = await createClient();
    const { error } = await supabase
      .from("businesses")
      .update({
        email_from_name: data.emailFromName.trim() || null,
        email_reply_to: data.emailReplyTo.trim() || null,
      })
      .eq("id", businessId);
    if (error) return { ok: false, error: "השמירה נכשלה" };
    revalidateIntegrations(businessId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "השמירה נכשלה" };
  }
}
