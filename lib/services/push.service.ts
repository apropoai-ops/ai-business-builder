import webpush from "web-push";

import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Web-push service — sends browser notifications to a user's registered
 * push subscriptions (see 0065_push_subscriptions.sql). Best-effort by
 * design: every entry point resolves silently when VAPID env vars are
 * missing, the user has no subscriptions, or a push endpoint fails.
 * NEVER throws.
 */

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

function getVapidConfig(): VapidConfig | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return {
    publicKey,
    privateKey,
    subject: process.env.VAPID_SUBJECT || "https://apropo.business",
  };
}

/**
 * Sends a push notification to every subscription of the given user.
 * Dead subscriptions (endpoint gone — HTTP 404/410) are deleted.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  try {
    const vapid = getVapidConfig();
    if (!vapid) return; // Push not configured — silent no-op.

    const supabase = createServiceRoleClient();
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);
    if (!subs || subs.length === 0) return;

    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? "/",
    });

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            body,
          );
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // Subscription expired or unsubscribed — clean it up.
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", sub.endpoint);
          }
        }
      }),
    );
  } catch {
    // Best-effort — push must never break the calling flow.
  }
}

/**
 * Resolves the business owner and sends them a push notification.
 * Used by server-side events (new order, new lead, booking...) to alert
 * the owner even when the dashboard is closed.
 */
export async function sendPushToBusinessOwner(
  businessId: string,
  payload: PushPayload,
): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { data: business } = await supabase
      .from("businesses")
      .select("owner_id")
      .eq("id", businessId)
      .maybeSingle();
    if (!business?.owner_id) return;
    await sendPushToUser(business.owner_id, payload);
  } catch {
    // Best-effort — never throws.
  }
}
