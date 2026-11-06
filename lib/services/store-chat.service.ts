import { createServiceRoleClient } from "@/lib/supabase/server";
import { pickBrandColor, type Palette } from "@/lib/storefront-brand";
import { normalizePhoneForWhatsapp } from "@/lib/phone";
import type { Business, WhatsappConfig } from "@/types/database";

/**
 * Service-role data access for the storefront AI chat widget. Visitors are
 * anonymous (no Supabase session), so — same as
 * lib/services/whatsapp-webhook.service.ts — every query bypasses RLS and is
 * explicitly scoped by a business_id resolved from the (published) slug.
 */

const SLUG_RE = /^[a-z0-9-]{3,60}$/;

/** Validates a public site slug shape before it ever touches a query. */
export function isValidStoreSlug(slug: unknown): slug is string {
  return typeof slug === "string" && SLUG_RE.test(slug);
}

/** Strips invisible directional/zero-width chars that can sneak into a copied RTL link. */
function cleanSlug(slug: string): string {
  return slug.replace(/[​-‏‪-‮⁦-⁩﻿]/g, "").trim();
}

export type StoreChatConfig = {
  businessId: string;
  businessName: string;
  accent: string;
  enabled: boolean;
};

/** Public, cheap lookup for the GET /api/store-chat config endpoint. */
export async function resolveStoreChatConfig(
  rawSlug: string,
): Promise<StoreChatConfig | null> {
  const slug = cleanSlug(rawSlug);
  const supabase = createServiceRoleClient();

  const { data: website } = await supabase
    .from("websites")
    .select("business_id")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (!website) return null;

  const [{ data: business }, { data: brand }] = await Promise.all([
    supabase
      .from("businesses")
      .select("id, name, store_chat_enabled")
      .eq("id", website.business_id)
      .maybeSingle(),
    supabase
      .from("brand_assets")
      .select("color_palette")
      .eq("business_id", website.business_id)
      .maybeSingle(),
  ]);
  if (!business) return null;

  return {
    businessId: business.id,
    businessName: business.name ?? "העסק",
    accent: pickBrandColor((brand?.color_palette as Palette | null) ?? null),
    enabled: business.store_chat_enabled === true,
  };
}

/** Full business row, needed to build the AI system prompt. */
export async function getBusinessForChat(businessId: string): Promise<Business | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .maybeSingle();
  return data;
}

/** The business's WhatsApp agent config (tone/goals/FAQ), reused for the website chat prompt. */
export async function getWhatsappConfigForBusiness(
  businessId: string,
): Promise<WhatsappConfig | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("whatsapp_config")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();
  return data;
}

/** Neutral fallback config when the business never set up the WhatsApp agent. */
export function fallbackWhatsappConfig(businessId: string): WhatsappConfig {
  const now = new Date().toISOString();
  return {
    id: "",
    business_id: businessId,
    app_secret: null,
    greeting: null,
    tone: null,
    goals: [],
    faq: [],
    enabled: false,
    phone_number_id: null,
    access_token: null,
    display_phone: null,
    connected: false,
    generated_at: null,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Returns an existing session id if it belongs to this business, otherwise
 * creates a fresh one. `visitorKey` is a hashed, non-reversible identifier
 * (kept for a future chat inbox to group sessions from the same visitor).
 */
export async function getOrCreateStoreChatSession(
  businessId: string,
  sessionId: string | null,
  visitorKey: string,
): Promise<string> {
  const supabase = createServiceRoleClient();

  if (sessionId) {
    const { data } = await supabase
      .from("store_chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (data) return data.id;
  }

  const { data, error } = await supabase
    .from("store_chat_sessions")
    .insert({ business_id: businessId, visitor_key: visitorKey })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Failed to create store chat session: ${error?.message}`);
  }
  return data.id;
}

export async function insertStoreChatMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase.from("store_chat_messages").insert({ session_id: sessionId, role, content });
}

export async function getRecentStoreChatMessages(
  sessionId: string,
  limit = 12,
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("store_chat_messages")
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? [])
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
}

/** Loose match for an Israeli or international phone number inside free text. */
const PHONE_IN_TEXT_RE = /(\+?972[-\s]?\d{1,2}[-\s]?\d{3}[-\s]?\d{4}|0\d{1,2}[-\s]?\d{3}[-\s]?\d{4}|05\d[-\s]?\d{3}[-\s]?\d{4})/;

/** Extracts + normalizes a phone number from a chat message, if present. */
export function extractPhoneFromMessage(text: string): string | null {
  const match = text.match(PHONE_IN_TEXT_RE);
  if (!match) return null;
  return normalizePhoneForWhatsapp(match[0]);
}

/**
 * Creates a CRM lead from a website-chat visitor who shared a phone number
 * (idempotent on phone, mirrors ensureLeadFromContact in
 * whatsapp-webhook.service.ts but with source "website_chat" — that helper
 * hardcodes source "whatsapp" so it can't be reused here).
 */
export async function ensureLeadFromWebsiteChat(
  businessId: string,
  phone: string,
  messageSnippet: string,
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data: existing } = await supabase
    .from("crm_leads")
    .select("id")
    .eq("business_id", businessId)
    .eq("phone", phone)
    .maybeSingle();
  if (existing) return;

  await supabase.from("crm_leads").insert({
    business_id: businessId,
    name: phone,
    phone,
    status: "new",
    source: "website_chat",
    notes: messageSnippet ? `הודעה מהצ'אט באתר: ${messageSnippet.slice(0, 300)}` : null,
  });
}
