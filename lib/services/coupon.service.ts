import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { Coupon } from "@/types/database";

/**
 * Pure coupon evaluation — given a coupon row and an order subtotal, returns
 * the discount amount (₪) or a reason it can't be applied. No side effects, so
 * the same rules run on the storefront preview and at order time.
 */
/** last 9 digits, for forgiving phone matching (country code / leading zero). */
function last9(p: string | null | undefined): string {
  return (p ?? "").replace(/\D/g, "").slice(-9);
}

export function evalCoupon(
  coupon: Pick<
    Coupon,
    "type" | "value" | "min_order" | "active" | "expires_at" | "max_uses" | "used_count" | "customer_phone"
  >,
  subtotal: number,
  ctx?: { phone?: string | null },
): { discount: number } | { error: string } {
  if (!coupon.active) return { error: "הקופון אינו פעיל" };
  // Personal coupon — only valid for the targeted shopper's phone.
  if (coupon.customer_phone) {
    const want = last9(coupon.customer_phone);
    if (!ctx?.phone || last9(ctx.phone) !== want) {
      return { error: "קופון אישי — אינו מתאים לפרטים שהוזנו" };
    }
  }
  if (coupon.max_uses != null && coupon.used_count >= coupon.max_uses) {
    return { error: "הקופון מוצה" };
  }
  if (coupon.expires_at) {
    const today = new Date().toISOString().slice(0, 10);
    if (coupon.expires_at < today) return { error: "תוקף הקופון פג" };
  }
  const min = coupon.min_order != null ? Number(coupon.min_order) : null;
  if (min != null && subtotal < min) {
    return { error: `הקופון בתוקף מעל ₪${min.toLocaleString("he-IL")}` };
  }
  const value = Number(coupon.value);
  const discount =
    coupon.type === "percent"
      ? Math.round(subtotal * (value / 100))
      : Math.min(subtotal, value);
  return { discount: Math.max(0, discount) };
}

// ── Owner (RLS) ─────────────────────────────────────────────────────────────

export async function listCoupons(businessId: string): Promise<Coupon[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createCoupon(
  businessId: string,
  fields: {
    code: string;
    type: "percent" | "fixed";
    value: number;
    min_order: number | null;
    expires_at: string | null;
    max_uses: number | null;
    customer_phone?: string | null;
  },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("coupons").insert({ business_id: businessId, ...fields });
  if (error) {
    if (error.code === "23505") return { error: "קוד קופון כזה כבר קיים" };
    return { error: error.message };
  }
  return {};
}

export async function deleteCoupon(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("coupons").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setCouponActive(id: string, active: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("coupons").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Public (service role, scoped to published sites) ───────────────────────

/** Validates a code against a published site's business; returns the discount. */
export async function validateCouponForSite(
  slug: string,
  code: string,
  subtotal: number,
  ctx?: { phone?: string | null },
): Promise<{ ok: boolean; discount?: number; code?: string; error?: string }> {
  const s = createServiceRoleClient();
  const { data: website } = await s
    .from("websites")
    .select("business_id")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (!website) return { ok: false, error: "החנות אינה זמינה" };

  const norm = code.trim().toUpperCase();
  const { data: coupon } = await s
    .from("coupons")
    .select("*")
    .eq("business_id", website.business_id)
    .eq("code", norm)
    .maybeSingle();
  if (!coupon) return { ok: false, error: "קוד קופון לא קיים" };

  const r = evalCoupon(coupon, subtotal, ctx);
  if ("error" in r) return { ok: false, error: r.error };
  return { ok: true, discount: r.discount, code: norm };
}

/**
 * Redeems a coupon at order time (service role): re-validates against the
 * business + subtotal, increments used_count, and returns the discount. On any
 * problem it returns discount 0 so the order still goes through at full price.
 * Used for instant/free-method orders, where the order is final the moment
 * it's placed. Card orders use peekCouponDiscount + commitCouponRedemption
 * instead (see below) so an abandoned/failed checkout never consumes a use.
 */
export async function redeemCoupon(
  businessId: string,
  code: string | null | undefined,
  subtotal: number,
  ctx?: { phone?: string | null },
): Promise<{ discount: number; code: string | null }> {
  if (!code?.trim()) return { discount: 0, code: null };
  const s = createServiceRoleClient();
  const norm = code.trim().toUpperCase();
  const { data: coupon } = await s
    .from("coupons")
    .select("*")
    .eq("business_id", businessId)
    .eq("code", norm)
    .maybeSingle();
  if (!coupon) return { discount: 0, code: null };
  const r = evalCoupon(coupon, subtotal, ctx);
  if ("error" in r) return { discount: 0, code: null };
  // Atomic guarded increment: re-checks max_uses inside the UPDATE so two
  // concurrent redemptions can't both take the last remaining use. NULL back
  // means the coupon was exhausted between our read and the increment.
  const { data: newCount } = await s.rpc("adjust_coupon_use", {
    p_coupon_id: coupon.id,
    p_delta: 1,
  });
  if (newCount === null) return { discount: 0, code: null };
  return { discount: r.discount, code: norm };
}

/**
 * Validates a coupon and computes its discount WITHOUT consuming a use — for
 * card orders, where the order is created PENDING before payment is confirmed.
 * The caller persists the returned code on the order (orders.coupon_code) and
 * calls commitCouponRedemption once the card payment actually clears
 * (finalizePaidStoreOrder), so an abandoned/failed checkout never consumes a
 * coupon use. On any problem returns discount 0, mirroring redeemCoupon.
 */
export async function peekCouponDiscount(
  businessId: string,
  code: string | null | undefined,
  subtotal: number,
  ctx?: { phone?: string | null },
): Promise<{ discount: number; code: string | null }> {
  if (!code?.trim()) return { discount: 0, code: null };
  const s = createServiceRoleClient();
  const norm = code.trim().toUpperCase();
  const { data: coupon } = await s
    .from("coupons")
    .select("*")
    .eq("business_id", businessId)
    .eq("code", norm)
    .maybeSingle();
  if (!coupon) return { discount: 0, code: null };
  const r = evalCoupon(coupon, subtotal, ctx);
  if ("error" in r) return { discount: 0, code: null };
  return { discount: r.discount, code: norm };
}

/**
 * Bumps used_count for a coupon already applied (discount-wise) to a card
 * order at checkout time — called from finalizePaidStoreOrder once the
 * payment actually clears. No-op when the order carried no coupon or the
 * coupon has since been deleted. Does not re-validate (min order / expiry /
 * max uses) since the discount was already locked into the order's total at
 * checkout time; this call only accounts for the use.
 */
export async function commitCouponRedemption(
  businessId: string,
  code: string | null | undefined,
): Promise<void> {
  if (!code?.trim()) return;
  const s = createServiceRoleClient();
  const norm = code.trim().toUpperCase();
  const { data: coupon } = await s
    .from("coupons")
    .select("id")
    .eq("business_id", businessId)
    .eq("code", norm)
    .maybeSingle();
  if (!coupon) return;
  await s.rpc("adjust_coupon_use", { p_coupon_id: coupon.id, p_delta: 1 });
}

/**
 * Releases a previously-committed coupon use (used_count - 1, floored at 0) —
 * called when a PAID order carrying a coupon is cancelled, so the coupon
 * becomes available again. No-op when the order carried no coupon.
 */
export async function releaseCouponRedemption(
  businessId: string,
  code: string | null | undefined,
): Promise<void> {
  if (!code?.trim()) return;
  const s = createServiceRoleClient();
  const norm = code.trim().toUpperCase();
  const { data: coupon } = await s
    .from("coupons")
    .select("id")
    .eq("business_id", businessId)
    .eq("code", norm)
    .maybeSingle();
  if (!coupon) return;
  await s.rpc("adjust_coupon_use", { p_coupon_id: coupon.id, p_delta: -1 });
}
