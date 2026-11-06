import { getActiveIntegration } from "@/lib/services/integrations/credentials";
import { getSmsDriver } from "@/lib/services/sms/registry";
import { normalizePhoneForWhatsapp } from "@/lib/phone";

/**
 * Business-facing SMS entry point (LOCKED CONTRACT — other packages import
 * this directly). Resolves the business's active 'sms' integration, sends a
 * single text message through its driver, and is a no-op when no SMS
 * provider is connected. Best-effort by design — booking reminders and other
 * callers must not break because SMS failed or isn't configured, so this
 * NEVER throws.
 */
export async function sendBusinessSms(
  businessId: string,
  toPhone: string,
  text: string,
): Promise<void> {
  try {
    const active = await getActiveIntegration(businessId, "sms");
    if (!active) return; // no SMS provider connected — silent no-op

    const driver = getSmsDriver(active.provider);
    if (!driver) return;

    const digits = normalizePhoneForWhatsapp(toPhone);
    if (!digits) return;

    const result = await driver.send(active.credentials, `+${digits}`, text);
    if (!result.ok) {
      // Provider-level rejection (e.g. incomplete/broken stored credentials) —
      // there's no sms_log table to persist this to, so at least surface it
      // in server logs instead of failing completely silently.
      console.error(`[sms] send failed for business ${businessId} via ${active.provider}: ${result.error ?? "unknown error"}`);
    }
  } catch {
    // swallow — SMS is always a best-effort secondary channel
  }
}
