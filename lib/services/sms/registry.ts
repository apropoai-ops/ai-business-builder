import type { SmsDriver } from "@/lib/services/sms/types";
import { twilioDriver } from "@/lib/services/sms/providers/twilio";
import { inforuDriver } from "@/lib/services/sms/providers/inforu";

/** Registry of all supported SMS providers. Display order = connect UI order. */
export const SMS_DRIVERS: SmsDriver[] = [twilioDriver, inforuDriver];

export function getSmsDriver(id: string): SmsDriver | undefined {
  return SMS_DRIVERS.find((d) => d.id === id);
}

/** Public (no-secrets) metadata for rendering the connect UI. */
export function listSmsMeta() {
  return SMS_DRIVERS.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    docsUrl: d.docsUrl,
    credentialFields: d.credentialFields,
  }));
}

export type SmsMeta = ReturnType<typeof listSmsMeta>[number];
