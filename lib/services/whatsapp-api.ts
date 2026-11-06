/**
 * WhatsApp Business Cloud API (Meta Graph API) client.
 * Sends outbound text messages. Credentials are per-business.
 */

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION ?? "v21.0";

export async function sendWhatsappText(args: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  body: string;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${args.phoneNumberId}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: args.to,
        type: "text",
        text: { preview_url: false, body: args.body },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data?.error?.message ?? `HTTP ${res.status}`;
      return { ok: false, error: message };
    }
    return { ok: true, messageId: data?.messages?.[0]?.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
