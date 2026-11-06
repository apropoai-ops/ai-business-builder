"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { getCustomerUser } from "@/lib/auth/customer";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  createCoupon,
  deleteCoupon,
  setCouponActive,
  validateCouponForSite,
} from "@/lib/services/coupon.service";
import { getCustomerProfile } from "@/lib/services/customer-account.service";
import { getPlanForBusiness } from "@/lib/quota";
import { assertFeature } from "@/lib/entitlements";

// ── Owner actions ───────────────────────────────────────────────────────────

export async function createCouponAction(
  businessId: string,
  input: { code: string; type: "percent" | "fixed"; value: string; minOrder: string; expiresAt: string; maxUses: string; customerPhone?: string },
): Promise<{ error?: string }> {
  await requireUser();
  const plan = await getPlanForBusiness(businessId);
  try {
    assertFeature(plan, "store_full");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
  const code = input.code.trim().toUpperCase().replace(/\s+/g, "");
  if (code.length < 2 || code.length > 24 || !/^[A-Z0-9\-]+$/.test(code)) {
    return { error: "קוד לא תקין (אותיות לטיניות/מספרים, 2-24 תווים)" };
  }
  if (input.type !== "percent" && input.type !== "fixed") return { error: "סוג קופון לא תקין" };
  const value = Number(input.value);
  if (isNaN(value) || value <= 0) return { error: "ערך הנחה לא תקין" };
  if (input.type === "percent" && value > 100) return { error: "אחוז הנחה עד 100" };
  const minOrder = input.minOrder.trim() ? Number(input.minOrder) : null;
  if (minOrder !== null && (isNaN(minOrder) || minOrder < 0)) return { error: "סכום מינימום לא תקין" };
  const expiresAt = input.expiresAt.trim() || null;
  const maxUses = input.maxUses.trim() ? Math.floor(Number(input.maxUses)) : null;
  if (maxUses !== null && (isNaN(maxUses) || maxUses <= 0)) return { error: "מגבלת שימושים לא תקינה" };

  const customerPhone = input.customerPhone?.trim() || null;
  const res = await createCoupon(businessId, {
    code, type: input.type, value, min_order: minOrder, expires_at: expiresAt, max_uses: maxUses,
    customer_phone: customerPhone,
  });
  if (res.error) return res;
  revalidatePath(`/businesses/${businessId}/store`);
  return {};
}

export async function deleteCouponAction(
  businessId: string,
  couponId: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "store_full");
    await deleteCoupon(couponId);
    revalidatePath(`/businesses/${businessId}/store`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "המחיקה נכשלה" };
  }
}

export async function toggleCouponAction(
  businessId: string,
  couponId: string,
  active: boolean,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "store_full");
    await setCouponActive(couponId, active);
    revalidatePath(`/businesses/${businessId}/store`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

// ── Public action (anonymous storefront) ───────────────────────────────────

export async function validateCouponAction(
  slug: string,
  code: string,
  subtotal: number,
): Promise<{ ok: boolean; discount?: number; code?: string; error?: string }> {
  if (!(await checkRateLimit(`coupon:${slug}`, 30, 3600))) {
    return { ok: false, error: "יותר מדי ניסיונות — נסו שוב מאוחר יותר" };
  }
  const sub = Number(subtotal);
  if (!Number.isFinite(sub) || sub < 0) return { ok: false, error: "סכום לא תקין" };
  if (typeof code !== "string" || code.trim().length < 2) return { ok: false, error: "נא להזין קוד" };

  // For personal coupons: use the signed-in shopper's saved phone for the preview.
  const user = await getCustomerUser();
  const profile = user ? await getCustomerProfile(user.id) : null;
  const phone = profile?.phone ?? null;

  return validateCouponForSite(slug, code.slice(0, 24), sub, { phone });
}
