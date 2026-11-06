import { createServiceRoleClient } from "@/lib/supabase/server";
import { getGateway } from "@/lib/gateways/registry";
import { encryptJson, decryptJson } from "@/lib/gateways/crypto";
import type {
  GatewayCredentials,
  GatewayDriver,
} from "@/lib/gateways/types";

/**
 * Merchant payment-gateway connections — CRUD + active-gateway resolution for
 * storefront checkout. Credentials are encrypted at rest (lib/gateways/crypto)
 * and only ever decrypted server-side, just before a charge. All writes go
 * through the service-role client; the client/owner never receives secrets.
 */

/** Non-secret view of a connection for the dashboard UI. */
export type ConnectionSummary = {
  provider: string;
  enabled: boolean;
  connected: boolean; // has stored credentials
  updatedAt: string;
};

export async function listConnections(businessId: string): Promise<ConnectionSummary[]> {
  const s = createServiceRoleClient();
  const { data } = await s
    .from("store_payment_connections")
    .select("provider, enabled, credentials_encrypted, updated_at")
    .eq("business_id", businessId);
  return (data ?? []).map((r) => ({
    provider: r.provider,
    enabled: r.enabled,
    connected: Boolean(r.credentials_encrypted),
    updatedAt: r.updated_at,
  }));
}

/**
 * The business's single ACTIVE gateway (enabled + has credentials), decrypted
 * and paired with its driver — or null when none is connected (caller then
 * falls back to the platform Stripe checkout). Best-effort: returns null on any
 * decryption/lookup failure rather than throwing into the checkout flow.
 */
export async function getActiveGateway(businessId: string): Promise<{
  provider: string;
  driver: GatewayDriver;
  credentials: GatewayCredentials;
} | null> {
  try {
    const s = createServiceRoleClient();
    const { data } = await s
      .from("store_payment_connections")
      .select("provider, credentials_encrypted")
      .eq("business_id", businessId)
      .eq("enabled", true)
      .not("credentials_encrypted", "is", null)
      .limit(1)
      .maybeSingle();
    if (!data?.credentials_encrypted) return null;
    const driver = getGateway(data.provider);
    if (!driver) return null;
    const credentials = decryptJson<GatewayCredentials>(data.credentials_encrypted);
    return { provider: data.provider, driver, credentials };
  } catch {
    return null;
  }
}

export async function hasActiveGateway(businessId: string): Promise<boolean> {
  return (await getActiveGateway(businessId)) !== null;
}

/**
 * Decrypted credentials + driver for a specific (business, provider) pair —
 * used by the payment callback route to verify an incoming notification.
 * Unlike getActiveGateway this does not require `enabled` (a payment may still
 * be settling when the owner toggles it). Returns null on any failure.
 */
export async function getConnectionCredentials(
  businessId: string,
  provider: string,
): Promise<{ driver: GatewayDriver; credentials: GatewayCredentials } | null> {
  try {
    const driver = getGateway(provider);
    if (!driver) return null;
    const s = createServiceRoleClient();
    const { data } = await s
      .from("store_payment_connections")
      .select("credentials_encrypted")
      .eq("business_id", businessId)
      .eq("provider", provider)
      .maybeSingle();
    if (!data?.credentials_encrypted) return null;
    return { driver, credentials: decryptJson<GatewayCredentials>(data.credentials_encrypted) };
  } catch {
    return null;
  }
}

/**
 * Validates the submitted credentials against the provider's required fields,
 * encrypts them, and upserts the connection row. Does NOT auto-enable — the
 * owner enables it explicitly (setConnectionEnabled).
 */
export async function saveConnection(
  businessId: string,
  provider: string,
  credentials: GatewayCredentials,
): Promise<{ ok: boolean; error?: string }> {
  const driver = getGateway(provider);
  if (!driver) return { ok: false, error: "ספק סליקה לא מוכר" };

  const clean: GatewayCredentials = {};
  for (const field of driver.credentialFields) {
    const val = (credentials[field.key] ?? "").toString().trim();
    if (field.required && !val) {
      return { ok: false, error: `חסר שדה חובה: ${field.label}` };
    }
    if (val) clean[field.key] = val;
  }

  const encrypted = encryptJson(clean);
  const s = createServiceRoleClient();
  const { error } = await s
    .from("store_payment_connections")
    .upsert(
      {
        business_id: businessId,
        provider,
        credentials_encrypted: encrypted,
        meta: { connected_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,provider" },
    );
  if (error) return { ok: false, error: "שמירת החיבור נכשלה" };
  return { ok: true };
}

/**
 * Enables/disables a provider. Enabling one disables every OTHER provider for
 * the business, so exactly one gateway is ever active (the storefront routes
 * card payments through it).
 */
export async function setConnectionEnabled(
  businessId: string,
  provider: string,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const s = createServiceRoleClient();
  if (enabled) {
    const { data: conn } = await s
      .from("store_payment_connections")
      .select("credentials_encrypted")
      .eq("business_id", businessId)
      .eq("provider", provider)
      .maybeSingle();
    if (!conn?.credentials_encrypted) {
      return { ok: false, error: "יש לחבר את הספק (להזין פרטים) לפני ההפעלה" };
    }
    // Single active gateway — turn the rest off first.
    await s
      .from("store_payment_connections")
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq("business_id", businessId)
      .neq("provider", provider);
  }
  const { error } = await s
    .from("store_payment_connections")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("business_id", businessId)
    .eq("provider", provider);
  if (error) return { ok: false, error: "העדכון נכשל" };
  return { ok: true };
}

export async function deleteConnection(
  businessId: string,
  provider: string,
): Promise<{ ok: boolean; error?: string }> {
  const s = createServiceRoleClient();
  const { error } = await s
    .from("store_payment_connections")
    .delete()
    .eq("business_id", businessId)
    .eq("provider", provider);
  if (error) return { ok: false, error: "המחיקה נכשלה" };
  return { ok: true };
}
