import { createServiceRoleClient } from "@/lib/supabase/server";
import { encryptJson, decryptJson } from "@/lib/gateways/crypto";

/**
 * Generic credentials store for third-party integrations that don't already
 * have their own dedicated table (payment gateways → store_payment_connections,
 * WhatsApp → whatsapp_config). Backed by business_integrations (0063).
 *
 * Credentials are AES-256-GCM encrypted at rest via lib/gateways/crypto (the
 * same helper store_payment_connections uses) — the JSON record is never
 * stored in plaintext, and is only ever decrypted server-side.
 *
 * LOCKED CONTRACT — do not change these signatures; other packages import
 * this module directly.
 */

export type IntegrationCategory = "invoicing" | "sms" | "other";

export type IntegrationSummary = {
  provider: string;
  category: string;
  status: string;
  connected_at: string;
};

/**
 * Encrypts and upserts a provider's credentials for a business.
 *
 * Merges onto any previously-stored credentials rather than replacing them
 * outright — the edit dialog only ever sends the fields the owner actually
 * typed (secrets are never echoed back to the client), so a partial update
 * must not wipe out untouched fields like a Twilio accountSid that wasn't
 * retyped this time.
 */
export async function saveIntegrationCredentials(
  businessId: string,
  provider: string,
  category: IntegrationCategory,
  credentials: Record<string, string>,
): Promise<void> {
  const s = createServiceRoleClient();

  let merged = credentials;
  const { data: existing } = await s
    .from("business_integrations")
    .select("credentials_enc")
    .eq("business_id", businessId)
    .eq("provider", provider)
    .maybeSingle();
  if (existing?.credentials_enc) {
    try {
      const previous = decryptJson<Record<string, string>>(existing.credentials_enc);
      merged = { ...previous, ...credentials };
    } catch {
      // Previous record unreadable (e.g. key rotation) — fall back to only the newly submitted values.
    }
  }

  const encrypted = encryptJson(merged);
  const { error } = await s.from("business_integrations").upsert(
    {
      business_id: businessId,
      provider,
      category,
      credentials_enc: encrypted,
      status: "connected",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id,provider" },
  );
  if (error) throw new Error("שמירת פרטי החיבור נכשלה");
}

/** Decrypted credentials for a specific (business, provider) pair, or null. */
export async function getIntegrationCredentials(
  businessId: string,
  provider: string,
): Promise<Record<string, string> | null> {
  try {
    const s = createServiceRoleClient();
    const { data } = await s
      .from("business_integrations")
      .select("credentials_enc")
      .eq("business_id", businessId)
      .eq("provider", provider)
      .maybeSingle();
    if (!data?.credentials_enc) return null;
    return decryptJson<Record<string, string>>(data.credentials_enc);
  } catch {
    return null;
  }
}

/**
 * The business's single active (status='connected') integration for a
 * category — used by consumers (invoicing, SMS) to resolve which provider to
 * dispatch to without knowing provider names. Returns null when none is
 * connected. Best-effort: never throws.
 */
export async function getActiveIntegration(
  businessId: string,
  category: IntegrationCategory,
): Promise<{ provider: string; credentials: Record<string, string> } | null> {
  try {
    const s = createServiceRoleClient();
    const { data } = await s
      .from("business_integrations")
      .select("provider, credentials_enc")
      .eq("business_id", businessId)
      .eq("category", category)
      .eq("status", "connected")
      .limit(1)
      .maybeSingle();
    if (!data?.credentials_enc) return null;
    return {
      provider: data.provider,
      credentials: decryptJson<Record<string, string>>(data.credentials_enc),
    };
  } catch {
    return null;
  }
}

/** Non-secret list of every connected integration for a business (for the hub UI). */
export async function listIntegrations(businessId: string): Promise<IntegrationSummary[]> {
  const s = createServiceRoleClient();
  const { data } = await s
    .from("business_integrations")
    .select("provider, category, status, connected_at")
    .eq("business_id", businessId);
  return data ?? [];
}

export async function disconnectIntegration(businessId: string, provider: string): Promise<void> {
  const s = createServiceRoleClient();
  const { error } = await s
    .from("business_integrations")
    .delete()
    .eq("business_id", businessId)
    .eq("provider", provider);
  if (error) throw new Error("הניתוק נכשל");
}
