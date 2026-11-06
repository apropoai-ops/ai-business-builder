"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import { upsertWhatsappConfig } from "@/lib/services/whatsapp.service";
import { markConversationHandled } from "@/lib/services/whatsapp-webhook.service";
import { createLead } from "@/lib/services/crm.service";
import { getPlanForBusiness, getActiveAddonsForBusiness } from "@/lib/quota";
import { assertFeature } from "@/lib/entitlements";
import type { Json } from "@/types/database";
import type { FaqItem } from "@/lib/ai/schemas/whatsapp";

export async function saveWhatsappConfigAction(
  businessId: string,
  data: {
    greeting: string;
    tone: string;
    goals: string[];
    faq: FaqItem[];
    enabled: boolean;
  },
): Promise<{ error?: string }> {
  await requireUser();
  try {
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "whatsapp_agent", await getActiveAddonsForBusiness(businessId));
    await upsertWhatsappConfig(businessId, {
      greeting: data.greeting,
      tone: data.tone,
      goals: data.goals as unknown as Json,
      faq: data.faq as unknown as Json,
      enabled: data.enabled,
    });
    revalidatePath(`/businesses/${businessId}/whatsapp`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

export async function saveWhatsappConnectionAction(
  businessId: string,
  data: {
    phone_number_id: string;
    access_token: string;
    app_secret: string;
    display_phone: string;
    connected: boolean;
  },
): Promise<{ error?: string }> {
  await requireUser();
  try {
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "whatsapp_agent", await getActiveAddonsForBusiness(businessId));
    await upsertWhatsappConfig(businessId, {
      phone_number_id: data.phone_number_id.trim() || null,
      // Secrets are never sent back to the browser, so an empty field means
      // "keep the saved value" rather than "clear it".
      access_token: data.access_token.trim() || undefined,
      app_secret: data.app_secret.trim() || undefined,
      display_phone: data.display_phone.trim() || null,
      connected: data.connected,
    });
    revalidatePath(`/businesses/${businessId}/whatsapp`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

/**
 * Clears a conversation off the owner's follow-up queue.
 *
 * Explicitly a human action, not something the agent can do for itself — the
 * whole point of the queue is that the agent answering is not the same as the
 * customer being taken care of.
 */
export async function markWhatsappHandledAction(
  businessId: string,
  conversationId: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    // markConversationHandled uses the service-role client (it also runs from
    // the unauthenticated webhook), so it bypasses RLS entirely — unlike
    // getPlanForBusiness (a service-role quota lookup, not an ownership
    // check), getBusiness() reads through the caller's RLS-scoped client and
    // returns null for a business the signed-in user doesn't own. This is the
    // only check standing between any signed-in user and clearing another
    // business's WhatsApp follow-up queue.
    if (!(await getBusiness(businessId))) return { error: "העסק לא נמצא" };
    await markConversationHandled(conversationId, businessId);
    revalidatePath(`/businesses/${businessId}/whatsapp`);
    revalidatePath(`/businesses/${businessId}/crm`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

/** Captures a lead from a WhatsApp playground conversation into the CRM. */
export async function captureWhatsappLeadAction(
  businessId: string,
  data: { name: string; phone?: string; notes?: string },
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await createLead(businessId, {
      name: data.name,
      phone: data.phone || null,
      status: "new",
      source: "whatsapp",
      notes: data.notes || null,
    });
    revalidatePath(`/businesses/${businessId}/crm`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}
