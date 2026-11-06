"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { getCustomerUser } from "@/lib/auth/customer";
import { isPaymentMethod } from "@/lib/payments";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  setOrderStatus,
  setSupplierOrdered,
  createPublicOrder,
  createPublicCartOrder,
  listOrders,
  type CartLine,
} from "@/lib/services/orders.service";
import { getBusiness } from "@/lib/services/business.service";
import type { Order } from "@/types/database";
import {
  storeCardEnabledBySlug,
  createStorePaymentRedirect,
} from "@/lib/services/store-checkout.service";

// ── Owner actions ───────────────────────────────────────────────────────────

export async function setOrderStatusAction(
  businessId: string,
  orderId: string,
  status: "confirmed" | "done" | "cancelled",
): Promise<{ error?: string }> {
  await requireUser();
  try {
    await setOrderStatus(orderId, status);
    revalidatePath(`/businesses/${businessId}/orders`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

/**
 * Owner toggle for the dropship "sent to supplier" marker (orders.supplier_ordered_at).
 */
export async function markSupplierOrderedAction(
  businessId: string,
  orderId: string,
  ordered: boolean,
): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  try {
    await setSupplierOrdered(orderId, ordered);
    revalidatePath(`/businesses/${businessId}/orders`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "שגיאה" };
  }
}

/** Loads the next page of orders (used by the "טען עוד" button). */
export async function loadMoreOrdersAction(businessId: string, page: number): Promise<{ items: Order[]; error?: string }> {
  await requireUser();
  try {
    if (!(await getBusiness(businessId))) return { items: [], error: "העסק לא נמצא" };
    return { items: await listOrders(businessId, { page }) };
  } catch (e) { return { items: [], error: e instanceof Error ? e.message : "שגיאה" }; }
}

// ── Public actions (anonymous visitors on /s/[slug]) ───────────────────────

export async function submitOrderAction(
  slug: string,
  input: {
    productId: string;
    quantity: number;
    name: string;
    phone: string;
    notes?: string;
    variant?: string;
    company_website?: string; // honeypot
  },
): Promise<{ ok: boolean; error?: string }> {
  if (input.company_website) return { ok: true }; // bot — pretend success

  if (!(await checkRateLimit(`order:${slug}`, 15, 3600))) {
    return { ok: false, error: "יותר מדי בקשות כרגע — נסו שוב מאוחר יותר" };
  }

  const name = input.name?.trim().slice(0, 120);
  const phone = input.phone?.trim().slice(0, 40);
  const quantity = Number(input.quantity);
  const notes = input.notes?.trim() ?? "";

  if (!name || name.length < 2) return { ok: false, error: "נא למלא שם" };
  if (!phone || phone.replace(/\D/g, "").length < 9) {
    return { ok: false, error: "נא למלא טלפון תקין" };
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return { ok: false, error: "כמות לא תקינה" };
  }
  if (notes.length > 300) return { ok: false, error: "ההערות ארוכות מדי (עד 300 תווים)" };

  const variant = input.variant?.trim().slice(0, 120) || null;

  // If a shopper is signed in, link the order to their account (for history).
  const customer = await getCustomerUser();

  return createPublicOrder(slug, {
    productId: input.productId,
    quantity,
    name,
    phone,
    notes: notes || null,
    variant,
    customerUserId: customer?.id ?? null,
  });
}

export async function submitCartOrderAction(
  slug: string,
  input: {
    items: CartLine[];
    name: string;
    phone: string;
    email?: string;
    address?: string;
    notes?: string;
    couponCode?: string;
    paymentMethod?: string;
    shippingMethodId?: string;
    shippingRegion?: string;
    shippingPoint?: string;
    redeemPoints?: boolean;
    referralCode?: string;
    company_website?: string; // honeypot
  },
): Promise<{ ok: boolean; error?: string }> {
  if (input.company_website) return { ok: true }; // bot — pretend success

  if (!(await checkRateLimit(`order:${slug}`, 15, 3600))) {
    return { ok: false, error: "יותר מדי בקשות כרגע — נסו שוב מאוחר יותר" };
  }

  const name = input.name?.trim().slice(0, 120);
  const phone = input.phone?.trim().slice(0, 40);
  const address = input.address?.trim().slice(0, 200) || undefined;
  const notes = input.notes?.trim().slice(0, 300) ?? "";

  if (!name || name.length < 2) return { ok: false, error: "נא למלא שם" };
  if (!phone || phone.replace(/\D/g, "").length < 9) {
    return { ok: false, error: "נא למלא טלפון תקין" };
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, error: "הסל ריק" };
  }
  if (input.items.length > 50) return { ok: false, error: "יותר מדי פריטים בסל" };

  // Sanitize each line (UUID product id + sane quantity + short variant/engraving).
  const items: CartLine[] = [];
  for (const it of input.items) {
    if (typeof it?.productId !== "string" || !/^[0-9a-f-]{36}$/i.test(it.productId)) {
      return { ok: false, error: "פריט לא תקין בסל" };
    }
    const qty = Math.floor(Number(it.quantity));
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      return { ok: false, error: "כמות לא תקינה" };
    }
    const variantId =
      typeof it.variantId === "string" && /^[0-9a-f-]{36}$/i.test(it.variantId)
        ? it.variantId
        : null;
    items.push({
      productId: it.productId,
      quantity: qty,
      variant: typeof it.variant === "string" ? it.variant.slice(0, 120) : null,
      variantId,
      engraving: typeof it.engraving === "string" ? it.engraving.trim().slice(0, 128) || null : null,
    });
  }

  const couponCode = typeof input.couponCode === "string" ? input.couponCode.slice(0, 24) : null;
  const paymentMethod = isPaymentMethod(input.paymentMethod) ? input.paymentMethod : null;
  const shippingMethodId =
    typeof input.shippingMethodId === "string" && /^[0-9a-f-]{36}$/i.test(input.shippingMethodId)
      ? input.shippingMethodId
      : null;
  const shippingRegion = typeof input.shippingRegion === "string" ? input.shippingRegion.slice(0, 80) : null;
  const shippingPoint = typeof input.shippingPoint === "string" ? input.shippingPoint.slice(0, 120) : null;

  // If a shopper is signed in, link the order to their account (for history).
  const customer = await getCustomerUser();

  const email =
    typeof input.email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim())
      ? input.email.trim().slice(0, 160)
      : null;

  return createPublicCartOrder(slug, {
    items,
    name,
    phone,
    email,
    address,
    notes: notes || null,
    couponCode,
    customerUserId: customer?.id ?? null,
    paymentMethod,
    shippingMethodId,
    shippingRegion,
    shippingPoint,
    redeemPoints: input.redeemPoints === true,
    referralCode: typeof input.referralCode === "string" ? input.referralCode.slice(0, 16) : null,
  });
}

/**
 * Starts an on-site CARD checkout via Stripe: creates a PENDING order (no CRM
 * lead/task, no fulfillment yet) and returns the Stripe Checkout URL to
 * redirect the shopper to. The order is finalized by the webhook on payment.
 */
export async function startStoreCardCheckoutAction(
  slug: string,
  input: {
    items: CartLine[];
    name: string;
    phone: string;
    address?: string;
    notes?: string;
    couponCode?: string;
    shippingMethodId?: string;
    shippingRegion?: string;
    shippingPoint?: string;
    company_website?: string; // honeypot
  },
): Promise<{ ok: boolean; error?: string; url?: string }> {
  if (input.company_website) return { ok: true };
  if (!(await storeCardEnabledBySlug(slug))) {
    return { ok: false, error: "תשלום בכרטיס אשראי אינו זמין בחנות זו" };
  }
  if (!(await checkRateLimit(`order:${slug}`, 15, 3600))) {
    return { ok: false, error: "יותר מדי בקשות כרגע — נסו שוב מאוחר יותר" };
  }

  const name = input.name?.trim().slice(0, 120);
  const phone = input.phone?.trim().slice(0, 40);
  const address = input.address?.trim().slice(0, 200) || undefined;
  const notes = input.notes?.trim().slice(0, 300) ?? "";

  if (!name || name.length < 2) return { ok: false, error: "נא למלא שם" };
  if (!phone || phone.replace(/\D/g, "").length < 9) {
    return { ok: false, error: "נא למלא טלפון תקין" };
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { ok: false, error: "הסל ריק" };
  }
  if (input.items.length > 50) return { ok: false, error: "יותר מדי פריטים בסל" };

  const items: CartLine[] = [];
  for (const it of input.items) {
    if (typeof it?.productId !== "string" || !/^[0-9a-f-]{36}$/i.test(it.productId)) {
      return { ok: false, error: "פריט לא תקין בסל" };
    }
    const qty = Math.floor(Number(it.quantity));
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      return { ok: false, error: "כמות לא תקינה" };
    }
    const variantId =
      typeof it.variantId === "string" && /^[0-9a-f-]{36}$/i.test(it.variantId)
        ? it.variantId
        : null;
    items.push({
      productId: it.productId,
      quantity: qty,
      variant: typeof it.variant === "string" ? it.variant.slice(0, 120) : null,
      variantId,
      engraving: typeof it.engraving === "string" ? it.engraving.trim().slice(0, 128) || null : null,
    });
  }

  const couponCode = typeof input.couponCode === "string" ? input.couponCode.slice(0, 24) : null;
  const shippingMethodId =
    typeof input.shippingMethodId === "string" && /^[0-9a-f-]{36}$/i.test(input.shippingMethodId)
      ? input.shippingMethodId
      : null;
  const shippingRegion = typeof input.shippingRegion === "string" ? input.shippingRegion.slice(0, 80) : null;
  const shippingPoint = typeof input.shippingPoint === "string" ? input.shippingPoint.slice(0, 120) : null;

  const customer = await getCustomerUser();

  const order = await createPublicCartOrder(slug, {
    items,
    name,
    phone,
    address,
    notes: notes || null,
    couponCode,
    customerUserId: customer?.id ?? null,
    paymentMethod: "card",
    shippingMethodId,
    shippingRegion,
    shippingPoint,
    awaitingPayment: true,
  });
  if (!order.ok || !order.orderId) {
    return { ok: false, error: order.error ?? "יצירת ההזמנה נכשלה" };
  }
  if (!order.amount || order.amount <= 0) {
    return { ok: false, error: "סכום ההזמנה אינו תקין לתשלום בכרטיס" };
  }

  try {
    const url = await createStorePaymentRedirect({
      slug,
      orderId: order.orderId,
      amount: order.amount,
      customerName: name,
      customerPhone: phone,
    });
    return { ok: true, url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "פתיחת התשלום נכשלה" };
  }
}
