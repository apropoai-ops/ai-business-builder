/**
 * Shared types for SMS provider drivers. Mirrors the shape of
 * lib/gateways/types.ts (payment gateways) and lib/services/invoicing/types.ts
 * (invoicing drivers): each provider exposes a small driver object the SMS
 * service dispatches to by id.
 */

export type SmsSendResult = {
  ok: boolean;
  providerId?: string;
  error?: string;
};

export type SmsCredentialField = {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  required?: boolean;
  help?: string;
};

export type SmsDriver = {
  id: "twilio" | "inforu";
  name: string;
  description: string;
  docsUrl: string;
  credentialFields: SmsCredentialField[];
  /**
   * Sends a single SMS text message. Throws with a Hebrew message on
   * transport failure; provider-level rejections are returned as
   * { ok: false, error } instead of throwing.
   */
  send(
    credentials: Record<string, string>,
    to: string,
    text: string,
  ): Promise<SmsSendResult>;
};
