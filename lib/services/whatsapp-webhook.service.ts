import { createServiceRoleClient } from "@/lib/supabase/server";
import { fireAutomations } from "@/lib/services/automations.service";
import { sendPushToBusinessOwner } from "@/lib/services/push.service";
import { notifyOwner } from "@/lib/services/email.service";
import type {
  Business,
  WhatsappConfig,
  WhatsappConversation,
} from "@/types/database";

/**
 * Service-role data access for the WhatsApp webhook. The webhook has no
 * authenticated user, so these bypass RLS — every query is explicitly scoped
 * by business_id derived from the inbound phone_number_id.
 */

export async function findConfigByPhoneNumberId(
  phoneNumberId: string,
): Promise<WhatsappConfig | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("whatsapp_config")
    .select("*")
    .eq("phone_number_id", phoneNumberId)
    .eq("connected", true)
    .maybeSingle();
  return data;
}

/**
 * Has this exact inbound WhatsApp message already been stored? Meta redelivers
 * a webhook event when the handler is slow to respond (AI generation + send
 * can take seconds), and without this check a redelivery generates and sends
 * a second AI reply to the same customer message.
 */
export async function inboundMessageAlreadyProcessed(
  businessId: string,
  waMessageId: string,
): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("business_id", businessId)
    .eq("direction", "inbound")
    .eq("wa_message_id", waMessageId)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Puts a conversation on the owner's follow-up queue and tells them once.
 *
 * The agent answering is not the end of the job — it collects a lead, promises
 * a price, or hits something it was told not to invent, and then the thread
 * sits in an inbox nobody opens. This flags it and notifies.
 *
 * Only on the false -> true transition: a customer who sends eight messages in
 * a row is one person waiting, and eight push notifications for it is how an
 * owner learns to swipe the alerts away without reading them.
 *
 * Returns true if this call is what raised the flag.
 */
export async function flagConversationForFollowUp(args: {
  conversationId: string;
  businessId: string;
  contactName: string | null;
  contactPhone: string;
  lastMessage: string;
}): Promise<boolean> {
  const supabase = createServiceRoleClient();

  // Conditional update: `.eq("needs_reply", false)` makes the transition itself
  // the lock, so two messages arriving together can't both send an alert.
  const { data } = await supabase
    .from("whatsapp_conversations")
    .update({
      needs_reply: true,
      needs_reply_since: new Date().toISOString(),
      handled_at: null,
    })
    .eq("id", args.conversationId)
    .eq("needs_reply", false)
    .select("id");

  if (!data || data.length === 0) return false; // already waiting — stay quiet

  const who = args.contactName?.trim() || args.contactPhone;
  const preview = args.lastMessage.trim().slice(0, 90);

  // Fire-and-forget: a failed push must never fail the webhook, or Meta retries
  // the message and the customer gets answered twice.
  void sendPushToBusinessOwner(args.businessId, {
    title: `${who} ממתין לתשובה שלכם`,
    body: preview,
    url: `/businesses/${args.businessId}/crm?tab=whatsapp`,
  }).catch(() => {});

  void notifyOwner(
    args.businessId,
    `לקוח ממתין למענה בוואטסאפ — ${who}`,
    `<p>הסוכן טיפל בשיחה, ועכשיו היא ממתינה לכם.</p>
     <p><strong>${escapeHtml(who)}</strong> (${escapeHtml(args.contactPhone)})</p>
     <blockquote>${escapeHtml(preview)}</blockquote>`,
  ).catch(() => {});

  return true;
}

/** Clears the flag — called when the owner marks the conversation handled. */
export async function markConversationHandled(
  conversationId: string,
  businessId: string,
): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase
    .from("whatsapp_conversations")
    .update({ needs_reply: false, handled_at: new Date().toISOString() })
    .eq("id", conversationId)
    .eq("business_id", businessId);
}

/** How many conversations are waiting on a human right now. */
export async function countConversationsNeedingReply(
  businessId: string,
): Promise<number> {
  const supabase = createServiceRoleClient();
  const { count } = await supabase
    .from("whatsapp_conversations")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("needs_reply", true);
  return count ?? 0;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function getBusinessById(id: string): Promise<Business | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function upsertConversation(
  businessId: string,
  contactPhone: string,
  contactName: string | null,
): Promise<WhatsappConversation> {
  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .upsert(
      {
        business_id: businessId,
        contact_phone: contactPhone,
        contact_name: contactName,
        last_message_at: now,
      },
      { onConflict: "business_id,contact_phone" },
    )
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to upsert conversation: ${error?.message}`);
  }
  return data;
}

export async function insertWhatsappMessage(args: {
  businessId: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  content: string;
  waMessageId?: string | null;
}): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase.from("whatsapp_messages").insert({
    business_id: args.businessId,
    conversation_id: args.conversationId,
    direction: args.direction,
    content: args.content,
    wa_message_id: args.waMessageId ?? null,
  });
}

export async function getRecentMessages(
  conversationId: string,
  limit = 12,
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("direction, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? [])
    .reverse()
    .map((m) => ({
      role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));
}

/**
 * Creates a CRM lead for a first-time WhatsApp contact (idempotent on phone).
 */
export async function ensureLeadFromContact(
  businessId: string,
  contactPhone: string,
  contactName: string | null,
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data: existing } = await supabase
    .from("crm_leads")
    .select("id")
    .eq("business_id", businessId)
    .eq("phone", contactPhone)
    .maybeSingle();

  if (existing) return;

  await supabase.from("crm_leads").insert({
    business_id: businessId,
    name: contactName || contactPhone,
    phone: contactPhone,
    status: "new",
    source: "whatsapp",
  });

  // Fire-and-forget — never throws, never blocks the webhook response.
  void fireAutomations(businessId, "new_lead", {
    customerName: contactName || contactPhone,
    customerPhone: contactPhone,
    source: "whatsapp",
  });
}
