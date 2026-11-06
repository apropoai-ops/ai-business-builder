import type { SmsDriver, SmsSendResult } from "@/lib/services/sms/types";

/**
 * Twilio Programmable Messaging — global SMS API, Basic-auth REST.
 * Docs: https://www.twilio.com/docs/messaging/api/message-resource (confirmed
 * against the published REST reference).
 *
 * POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json
 * Basic auth: AccountSid:AuthToken. Body (form-encoded): From, To, Body.
 * `from` here is a Twilio phone number or approved Alphanumeric Sender ID —
 * Israel does not support alphanumeric sender IDs on Twilio for two-way
 * numbers, so most merchants will use a Twilio-purchased number.
 */

async function send(
  credentials: Record<string, string>,
  to: string,
  text: string,
): Promise<SmsSendResult> {
  const accountSid = credentials.accountSid?.trim();
  const authToken = credentials.authToken?.trim();
  const from = credentials.from?.trim();
  if (!accountSid || !authToken || !from) {
    return { ok: false, error: "חסרים פרטי חיבור ל-Twilio (Account SID / Auth Token / מספר שולח)" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
  const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const body = new URLSearchParams({ From: from, To: to, Body: text });

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
  } catch {
    return { ok: false, error: "לא ניתן היה להתחבר לשרת Twilio" };
  }

  let data: { sid?: string; message?: string; code?: number } | undefined;
  try {
    data = await res.json();
  } catch {
    // handled below
  }

  if (!res.ok) {
    return { ok: false, error: data?.message || `שגיאת Twilio (סטטוס ${res.status})` };
  }
  return { ok: true, providerId: data?.sid };
}

export const twilioDriver: SmsDriver = {
  id: "twilio",
  name: "Twilio",
  description: "שירות SMS גלובלי — נדרש חשבון Twilio ומספר שולח (נרכש בפאנל שלהם)",
  docsUrl: "https://www.twilio.com/docs/messaging/api/message-resource",
  credentialFields: [
    { key: "accountSid", label: "Account SID", required: true, placeholder: "ACxxxxxxxx...", help: "מופיע בדשבורד הראשי של Twilio" },
    { key: "authToken", label: "Auth Token", required: true, secret: true },
    { key: "from", label: "מספר שולח (Twilio)", required: true, placeholder: "+1415XXXXXXX" },
  ],
  send,
};
