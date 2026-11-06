import crypto from "node:crypto";

/**
 * AES-256-GCM encryption for merchant payment-gateway credentials at rest.
 * The key lives ONLY in the PAYMENTS_ENC_KEY env var (64 hex chars = 32 bytes),
 * never in the database — so a leaked `store_payment_connections` row is
 * useless without the app secret. Server-only (uses node:crypto).
 *
 * Format: base64( iv(12) || authTag(16) || ciphertext ).
 */

function key(): Buffer {
  const hex = process.env.PAYMENTS_ENC_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "PAYMENTS_ENC_KEY חסר או לא תקין (נדרשים 64 תווי hex) — לא ניתן לשמור פרטי סליקה",
    );
  }
  return Buffer.from(hex, "hex");
}

export function isCredsEncryptionConfigured(): boolean {
  const hex = process.env.PAYMENTS_ENC_KEY;
  return Boolean(hex && hex.length === 64);
}

export function encryptJson(value: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptJson<T = unknown>(payload: string): T {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}
