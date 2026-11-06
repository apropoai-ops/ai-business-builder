import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Loyalty points: shoppers earn points on completed orders and redeem them as a
 * discount at checkout. Balances live in loyalty_points (one row per business +
 * customer). Earn/redeem run server-side (service role) at order time; the
 * shopper reads their own balance via RLS.
 */

/** The signed-in shopper's own balance for a store (RLS). */
export async function getLoyaltyBalance(
  businessId: string,
  userId: string,
): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("loyalty_points")
    .select("points")
    .eq("business_id", businessId)
    .eq("customer_user_id", userId)
    .maybeSingle();
  return data?.points ?? 0;
}

/** Adds (or removes, when negative) points for a shopper. Never goes below 0.
 *  Atomic (single SQL upsert-increment) so concurrent orders can't
 *  double-earn/double-spend the same balance. */
export async function adjustPoints(
  businessId: string,
  userId: string,
  delta: number,
): Promise<void> {
  if (!delta) return;
  const s = createServiceRoleClient();
  await s.rpc("increment_loyalty_points", {
    p_business_id: businessId,
    p_customer_user_id: userId,
    p_delta: Math.round(delta),
  });
}

/**
 * Spends points atomically, at the moment the discount is decided. The UPDATE
 * behind this only matches while the balance still covers the WHOLE amount, so
 * two carts submitted in the same second can't both redeem it — the loser gets
 * false back and must fall back to no loyalty discount. Do not use adjustPoints
 * for a redemption: its greatest(0, ...) clamp swallows the shortfall silently
 * and the merchant ends up eating the difference.
 *
 * Returns false when the balance no longer covers `points` (or the shopper has
 * no balance row at all); true when the points were debited.
 */
export async function redeemPointsAtomic(
  businessId: string,
  userId: string,
  points: number,
): Promise<boolean> {
  const amount = Math.round(points);
  if (amount <= 0) return true;
  const s = createServiceRoleClient();
  const { data, error } = await s.rpc("adjust_loyalty_points_guarded", {
    p_business_id: businessId,
    p_customer_user_id: userId,
    p_delta: -amount,
  });
  return !error && data !== null;
}

/** Gives back points debited by redeemPointsAtomic for an order that then
 *  failed to save (mirrors releaseCouponRedemption on the coupon side). */
export async function refundRedeemedPoints(
  businessId: string,
  userId: string,
  points: number,
): Promise<void> {
  await adjustPoints(businessId, userId, Math.abs(Math.round(points)));
}

/** Service-role balance read (for the order flow, where there's no user session). */
export async function getBalanceServiceRole(
  businessId: string,
  userId: string,
): Promise<number> {
  const s = createServiceRoleClient();
  const { data } = await s
    .from("loyalty_points")
    .select("points")
    .eq("business_id", businessId)
    .eq("customer_user_id", userId)
    .maybeSingle();
  return data?.points ?? 0;
}
