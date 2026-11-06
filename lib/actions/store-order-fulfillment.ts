"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { markOrderShipped } from "@/lib/services/orders.service";

/**
 * Owner action: marks an order as shipped (status='shipped' + shipped_at, and
 * — when given — stamps tracking_number) and best-effort emails the customer
 * a Hebrew "your order shipped" notice. See lib/services/orders.service.ts
 * (markOrderShipped) for the actual logic.
 */
export async function markOrderShippedAction(
  businessId: string,
  orderId: string,
  trackingNumber: string | null,
): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  try {
    const res = await markOrderShipped(orderId, trackingNumber?.trim() || null);
    if (!res.ok) return res;
    revalidatePath(`/businesses/${businessId}/orders`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "העדכון נכשל" };
  }
}
