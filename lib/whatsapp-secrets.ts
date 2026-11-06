import { decryptJson, encryptJson, isCredsEncryptionConfigured } from "@/lib/gateways/crypto";

/**
 * At-rest protection for the per-business WhatsApp `access_token` and
 * `app_secret` (whatsapp_config). Same AES-256-GCM key as the payment-gateway
 * credentials, so a leaked row — or a team member reading it straight through
 * the REST API — is useless without the server's PAYMENTS_ENC_KEY.
 *
 * Values are stored as `enc:v1:<base64>`. Legacy plaintext values still read
 * back unchanged, so rows written before this existed keep working. Server-only.
 */
const PREFIX = "enc:v1:";

export function sealWhatsappSecret(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  if (v.startsWith(PREFIX) || !isCredsEncryptionConfigured()) return v;
  return PREFIX + encryptJson(v);
}

export function openWhatsappSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith(PREFIX)) return value;
  try {
    return decryptJson<string>(value.slice(PREFIX.length));
  } catch {
    return null; // wrong/rotated key — treat as not configured
  }
}
