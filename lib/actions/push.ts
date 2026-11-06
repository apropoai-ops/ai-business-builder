"use server";

import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";

/**
 * Saves a browser push subscription for the logged-in user (upsert by
 * endpoint, so re-subscribing from the same browser just refreshes keys).
 */
export async function savePushSubscriptionAction(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<{ ok: boolean; error?: string }> {
  const { user } = await requireUser();
  try {
    const endpoint = typeof sub?.endpoint === "string" ? sub.endpoint.trim() : "";
    const p256dh = typeof sub?.keys?.p256dh === "string" ? sub.keys.p256dh.trim() : "";
    const auth = typeof sub?.keys?.auth === "string" ? sub.keys.auth.trim() : "";
    if (!endpoint.startsWith("https://") || endpoint.length > 2000) {
      return { ok: false, error: "כתובת מינוי לא תקינה" };
    }
    if (!p256dh || !auth || p256dh.length > 500 || auth.length > 500) {
      return { ok: false, error: "מפתחות מינוי לא תקינים" };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        { user_id: user.id, endpoint, p256dh, auth },
        { onConflict: "endpoint" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "שמירת ההתראות נכשלה" };
  }
}

/**
 * Removes a push subscription of the logged-in user (RLS limits the delete
 * to the user's own rows).
 */
export async function removePushSubscriptionAction(
  endpoint: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  try {
    if (typeof endpoint !== "string" || !endpoint) {
      return { ok: false, error: "כתובת מינוי לא תקינה" };
    }
    const supabase = await createClient();
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "הסרת ההתראות נכשלה" };
  }
}
