import { createClient } from "@/lib/supabase/server";
import { sealWhatsappSecret } from "@/lib/whatsapp-secrets";
import { toRange } from "@/lib/services/pagination";
import type {
  WhatsappConfig,
  WhatsappConversation,
  WhatsappMessage,
  Json,
} from "@/types/database";

/** Standard page size for the WhatsApp conversations "טען עוד" pagination. */
export const WHATSAPP_PAGE_SIZE = 50;

export async function getWhatsappConfig(
  businessId: string,
): Promise<WhatsappConfig | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whatsapp_config")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load WhatsApp config: ${error.message}`);
  return data;
}

export async function upsertWhatsappConfig(
  businessId: string,
  fields: {
    greeting?: string | null;
    tone?: string | null;
    goals?: Json;
    faq?: Json;
    enabled?: boolean;
    phone_number_id?: string | null;
    access_token?: string | null;
    app_secret?: string | null;
    display_phone?: string | null;
    connected?: boolean;
    generated_at?: string | null;
  },
): Promise<void> {
  // Secrets are sealed at rest; `undefined` leaves the stored value untouched.
  const sealed = { ...fields };
  if (fields.access_token !== undefined) sealed.access_token = sealWhatsappSecret(fields.access_token);
  if (fields.app_secret !== undefined) sealed.app_secret = sealWhatsappSecret(fields.app_secret);
  const supabase = await createClient();
  const { error } = await supabase
    .from("whatsapp_config")
    .upsert(
      { business_id: businessId, ...sealed },
      { onConflict: "business_id" },
    );
  if (error) throw new Error(`Failed to save WhatsApp config: ${error.message}`);
}

/** Latest WhatsApp conversations, newest first, paged ~WHATSAPP_PAGE_SIZE at a time. */
export async function getWhatsappConversations(
  businessId: string,
  opts?: { page?: number },
): Promise<WhatsappConversation[]> {
  const [from, to] = toRange(opts?.page ?? 1, WHATSAPP_PAGE_SIZE);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("business_id", businessId)
    .order("last_message_at", { ascending: false })
    .range(from, to);
  if (error) throw new Error(`Failed to load conversations: ${error.message}`);
  return data ?? [];
}

export async function getConversationMessages(
  conversationId: string,
): Promise<WhatsappMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load messages: ${error.message}`);
  return data ?? [];
}

/**
 * Recent WhatsApp messages for a specific set of conversations, grouped by
 * conversation id — used by the follow-up queue to show each open
 * conversation's last message. Scoped to `conversationIds` (rather than
 * scanning every message the business has ever sent) so the query cost
 * stays proportional to how many conversations actually need a reply, not
 * to the business's total message history.
 */
export async function getMessagesByConversation(
  businessId: string,
  conversationIds: string[],
): Promise<Record<string, WhatsappMessage[]>> {
  if (conversationIds.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("*")
    .eq("business_id", businessId)
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false })
    .limit(conversationIds.length * 20);
  if (error) throw new Error(`Failed to load messages: ${error.message}`);

  const grouped: Record<string, WhatsappMessage[]> = {};
  for (const m of data ?? []) {
    (grouped[m.conversation_id] ??= []).push(m);
  }
  // Each conversation's messages come back newest-first (see .order above) —
  // flip to chronological so callers rendering a thread don't have to.
  for (const id in grouped) grouped[id].reverse();
  return grouped;
}
