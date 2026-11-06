import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  notifyOwner,
  sendEmail,
  emailConfigured,
  sendOrderConfirmationEmail,
} from "@/lib/services/email.service";
import { emailShell, escapeHtml } from "@/lib/email-templates";
import {
  redeemCoupon,
  peekCouponDiscount,
  releaseCouponRedemption,
} from "@/lib/services/coupon.service";
import { recoverAbandonedCart } from "@/lib/services/abandoned-cart.service";
import {
  adjustPoints,
  getBalanceServiceRole,
  redeemPointsAtomic,
  refundRedeemedPoints,
} from "@/lib/services/loyalty.service";
import { applyReferral } from "@/lib/services/referral.service";
import { resolveShipping } from "@/lib/shipping";
import { sellsOnline } from "@/lib/site-mode";
import { toRange } from "@/lib/services/pagination";
import type { Order, OrderItem } from "@/types/database";

const TZ = "Asia/Jerusalem";

/** Standard page size for the orders "טען עוד" pagination. */
export const ORDERS_PAGE_SIZE = 50;

/** A cart line item as sent from the public storefront. */
export type CartLine = {
  productId: string;
  quantity: number;
  variant?: string | null;
  variantId?: string | null;
  /** Personalization text the shopper typed for this line (or null/undefined when none). */
  engraving?: string | null;
};

/** Reads `{enabled, required}` from a product's `engraving` jsonb config, defensively. */
function isEngravingRequired(json: unknown): boolean {
  if (!json || typeof json !== "object" || Array.isArray(json)) return false;
  const obj = json as Record<string, unknown>;
  return obj.enabled === true && obj.required === true;
}

// ── Owner-side (RLS) ────────────────────────────────────────────────────────

/** Latest orders, newest first, paged ~ORDERS_PAGE_SIZE at a time. */
export async function listOrders(businessId: string, opts?: { page?: number }): Promise<Order[]> {
  const [from, to] = toRange(opts?.page ?? 1, ORDERS_PAGE_SIZE);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Line items grouped by order_id, for the owner orders view (RLS). */
export async function listOrderItemsByOrder(
  businessId: string,
): Promise<Record<string, OrderItem[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_items")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const map: Record<string, OrderItem[]> = {};
  for (const it of data ?? []) (map[it.order_id] ??= []).push(it);
  return map;
}

export async function setOrderStatus(id: string, status: string): Promise<void> {
  const supabase = await createClient();

  // Cancelling a PAID order releases what was committed at payment time (stock
  // + coupon use) back — best-effort, never blocks the status change itself.
  // Skipped for already-cancelled orders and any not-yet-paid order (nothing
  // was ever decremented/redeemed for those).
  if (status === "cancelled") {
    const { data: order } = await supabase
      .from("orders")
      .select("id, business_id, status, payment_status, coupon_code")
      .eq("id", id)
      .maybeSingle();
    if (order && order.status !== "cancelled" && order.payment_status === "paid") {
      await releasePaidOrderStockAndCoupon(order.business_id, id, order.coupon_code);
    }
  }

  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Restocks tracked-variant stock and releases a coupon's used_count for a
 * PAID order that's being cancelled. Service-role — the caller (setOrderStatus)
 * already confirmed ownership via the RLS-scoped select before invoking this.
 * Best-effort: any failure here must not block the cancellation itself.
 */
async function releasePaidOrderStockAndCoupon(
  businessId: string,
  orderId: string,
  couponCode: string | null,
): Promise<void> {
  try {
    const s = createServiceRoleClient();
    const { data: items } = await s
      .from("order_items")
      .select("variant_id, quantity")
      .eq("order_id", orderId);

    const decrements = new Map<string, number>();
    for (const it of items ?? []) {
      if (it.variant_id) decrements.set(it.variant_id, (decrements.get(it.variant_id) ?? 0) + it.quantity);
    }

    if (decrements.size > 0) {
      await Promise.all(
        [...decrements.entries()].map(([variantId, qty]) =>
          s.rpc("restock_variant_stock", { p_variant_id: variantId, p_qty: qty }),
        ),
      );
      // Re-flip in_stock for any product whose variants have stock again.
      const { data: variants } = await s
        .from("product_variants")
        .select("product_id")
        .in("id", [...decrements.keys()]);
      const productIds = [...new Set((variants ?? []).map((v) => v.product_id))];
      for (const pid of productIds) {
        const { data: vs } = await s.from("product_variants").select("stock_qty").eq("product_id", pid);
        const anyLeft = (vs ?? []).some((v) => Number(v.stock_qty) > 0);
        await s.from("products").update({ in_stock: anyLeft }).eq("id", pid);
      }
    }

    await releaseCouponRedemption(businessId, couponCode);
  } catch {
    // best-effort — cancellation must still go through
  }
}

/**
 * Marks a confirmed order as shipped: sets status='shipped' + shipped_at, and
 * (when a tracking number is given) stamps tracking_number. Best-effort sends
 * the customer a Hebrew "your order shipped" email when we can resolve an
 * email for them (signed-in shopper's auth email, or a matching CRM contact
 * by phone) — never blocks the status update on email failure.
 */
export async function markOrderShipped(
  orderId: string,
  trackingNumber: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, business_id, customer_user_id, customer_phone")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "ההזמנה לא נמצאה" };

  const { error } = await supabase
    .from("orders")
    .update({
      status: "shipped",
      shipped_at: new Date().toISOString(),
      ...(trackingNumber ? { tracking_number: trackingNumber } : {}),
    })
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };

  try {
    const email = await resolveOrderCustomerEmail(
      order.business_id,
      order.customer_user_id,
      order.customer_phone,
    );
    if (email) {
      const s = createServiceRoleClient();
      const { data: biz } = await s
        .from("businesses")
        .select("name")
        .eq("id", order.business_id)
        .maybeSingle();
      await sendOrderShippedEmail(email, {
        businessName: biz?.name ?? "החנות",
        trackingNumber: trackingNumber || null,
      });
    }
  } catch {
    // best-effort — the status update above already succeeded
  }

  return { ok: true };
}

/**
 * Best-effort customer email lookup — orders don't persist an email column
 * (checkout collects it transiently for the order-confirmation email), so we
 * try the signed-in shopper's auth email first, then a matching CRM contact
 * by phone. Mirrors the same lookup in lib/services/invoicing/index.ts.
 */
async function resolveOrderCustomerEmail(
  businessId: string,
  customerUserId: string | null,
  customerPhone: string | null,
): Promise<string | null> {
  const s = createServiceRoleClient();
  if (customerUserId) {
    try {
      const { data } = await s.auth.admin.getUserById(customerUserId);
      if (data?.user?.email) return data.user.email;
    } catch {
      // fall through to CRM lookup
    }
  }
  if (customerPhone) {
    const { data } = await s
      .from("crm_customers")
      .select("email")
      .eq("business_id", businessId)
      .eq("phone", customerPhone)
      .maybeSingle();
    if (data?.email) return data.email;
  }
  return null;
}

/** Hebrew "your order shipped" email to the customer (best-effort, never
 * throws) — built locally with the general sendEmail/emailShell helpers since
 * this is a one-off template not shared with lib/services/email.service.ts. */
async function sendOrderShippedEmail(
  to: string,
  args: { businessName: string; trackingNumber: string | null },
): Promise<void> {
  try {
    if (!emailConfigured() || !to) return;
    const subject = `ההזמנה שלך נשלחה — ${args.businessName}`;
    const body = `
      <p style="font-size:16px">חדשות טובות! ההזמנה שלך אצל <b>${args.businessName}</b> נשלחה בדרך אליך. 📦</p>
      ${args.trackingNumber ? `<p><b>מספר מעקב למשלוח:</b> <span dir="ltr">${args.trackingNumber}</span></p>` : ""}
      <p style="color:#71717a">תודה שקנית אצלנו!</p>`;
    await sendEmail({ to, subject, html: emailShell(subject, body) });
  } catch {
    // swallow — shipped email is best-effort
  }
}

/**
 * Marks (or unmarks) an order as forwarded to the dropship supplier — the
 * owner's manual "I sent this order to the supplier" checkbox. RLS-scoped
 * client enforces ownership the same way setOrderStatus does.
 */
export async function setSupplierOrdered(id: string, ordered: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ supplier_ordered_at: ordered ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Shared loyalty-earn + referral-credit logic, run once a store order is
 * actually paid for (free-method orders: immediately on insert; card orders:
 * from finalizePaidStoreOrder on Stripe webhook confirmation). The redemption
 * SPEND is only settled here for card orders — the free-method path debits it
 * atomically at checkout time (createPublicCartOrder) and passes pointsUsed 0.
 * Idempotent by construction: adjustPoints is a plain balance add (caller must
 * only invoke it once per order — both call sites guarantee that), and applyReferral
 * dedupes itself via a unique constraint on referrals(business_id,
 * referred_user_id), so crediting the same order twice is a safe no-op.
 */
export async function awardOrderLoyaltyAndReferral(args: {
  businessId: string;
  customerUserId: string | null;
  phone: string;
  merchAmount: number; // merchandise total the earn/referral rate applies to (post-discount, pre-shipping)
  pointsUsed?: number; // points already redeemed at checkout for this order (0 for card orders — redemption isn't offered there yet)
  referralCode?: string | null;
}): Promise<void> {
  if (!args.customerUserId) return;
  const s = createServiceRoleClient();

  const { data: loyaltyBiz } = await s
    .from("businesses")
    .select("loyalty_enabled, loyalty_earn, referral_enabled, referral_points")
    .eq("id", args.businessId)
    .maybeSingle();
  if (!loyaltyBiz) return;

  const loyaltyEnabled = !!loyaltyBiz.loyalty_enabled;
  const loyaltyEarn = Number(loyaltyBiz.loyalty_earn ?? 0) || 0;
  const pointsUsed = args.pointsUsed ?? 0;

  if (loyaltyEnabled) {
    if (pointsUsed > 0) await adjustPoints(args.businessId, args.customerUserId, -pointsUsed);
    const earned = Math.floor(Math.max(0, args.merchAmount) * loyaltyEarn);
    if (earned > 0) await adjustPoints(args.businessId, args.customerUserId, earned);
  }

  if (args.referralCode && loyaltyBiz.referral_enabled) {
    await applyReferral(
      args.businessId,
      args.referralCode,
      args.customerUserId,
      args.phone,
      Number(loyaltyBiz.referral_points) || 0,
    );
  }
}

/**
 * Reconstructs the merchandise amount (post-discount, pre-shipping) for an
 * already-placed order — used by finalizePaidStoreOrder (card orders), which
 * only has the persisted order row, not the in-memory checkout computation.
 * Prefers the persisted shipping_price (accurate when a defined shipping
 * method was chosen); falls back to replicating the legacy flat-fee/threshold
 * rule when no shipping method was recorded, so the earn amount doesn't
 * silently include the shipping charge.
 */
export async function estimateOrderMerchAmount(
  businessId: string,
  order: { total: number | null; shipping_method: string | null; shipping_price: number | null },
): Promise<number> {
  const total = Number(order.total ?? 0) || 0;
  if (order.shipping_method) {
    return Math.max(0, total - (Number(order.shipping_price ?? 0) || 0));
  }
  // Legacy flat-fee path: shipping_price wasn't persisted — replicate the same
  // fee/threshold rule used at order time, working backward from the total.
  const s = createServiceRoleClient();
  const { data: biz } = await s
    .from("businesses")
    .select("shipping_fee, free_shipping_threshold")
    .eq("id", businessId)
    .maybeSingle();
  const fee = Number(biz?.shipping_fee ?? 0) || 0;
  const threshold = biz?.free_shipping_threshold != null ? Number(biz.free_shipping_threshold) : null;
  if (fee <= 0) return total;
  // If the merch-only total (total minus the fee) already clears the free
  // threshold, the fee wouldn't have been charged — so it isn't in `total`.
  const merchIfFeeCharged = total - fee;
  const qualifiesFree =
    threshold != null && threshold > 0 && merchIfFeeCharged >= threshold;
  return Math.max(0, qualifiesFree ? total : merchIfFeeCharged);
}

// ── Public (service role, scoped to published sites) ───────────────────────

/**
 * Creates a store order from the public site (/s/[slug]):
 * resolves the published website → business, verifies the product is active,
 * inserts the order with a product-name snapshot, creates a high-priority
 * CRM task and mirrors the customer into the CRM as a lead (dedupe by phone).
 */
export async function createPublicOrder(
  slug: string,
  input: {
    productId: string;
    quantity: number;
    name: string;
    phone: string;
    notes?: string | null;
    variant?: string | null;
    customerUserId?: string | null;
  },
): Promise<{ ok: boolean; error?: string }> {
  const s = createServiceRoleClient();

  const { data: website } = await s
    .from("websites")
    .select("business_id")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (!website) return { ok: false, error: "החנות אינה זמינה כרגע" };

  // Same public-POST reasoning as createPublicCartOrder below: published is not
  // the same question as "sells". Without this, a hand-crafted request could
  // order a single product from a brochure site or a catalog-only shop window.
  const { data: sellingBusiness } = await s
    .from("businesses")
    .select("site_mode, catalog_only")
    .eq("id", website.business_id)
    .maybeSingle();
  if (
    !sellsOnline(sellingBusiness?.site_mode, {
      catalogOnly: sellingBusiness?.catalog_only,
    })
  ) {
    return { ok: false, error: "החנות אינה זמינה כרגע" };
  }

  const { data: product } = await s
    .from("products")
    .select("id,name")
    .eq("id", input.productId)
    .eq("business_id", website.business_id)
    .eq("active", true)
    .maybeSingle();
  if (!product) return { ok: false, error: "המוצר אינו זמין" };

  const variant = input.variant?.trim() || null;
  const variantSuffix = variant ? ` (${variant})` : "";

  const { error } = await s.from("orders").insert({
    business_id: website.business_id,
    product_id: product.id,
    product_name: product.name, // snapshot — survives product edits/deletes
    quantity: input.quantity,
    variant,
    customer_name: input.name,
    customer_phone: input.phone,
    customer_user_id: input.customerUserId || null,
    notes: input.notes || null,
  });
  if (error) return { ok: false, error: "השמירה נכשלה — נסו שוב" };

  // Owner gets a high-priority task to confirm the order (due today, Israel time).
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  await s.from("crm_tasks").insert({
    business_id: website.business_id,
    title: `הזמנה חדשה: ${input.quantity}× ${product.name}${variantSuffix} — ${input.name} (${input.phone})`,
    priority: "high",
    due_date: today,
  });

  // Mirror into CRM as a lead (dedupe by phone).
  const { data: existing } = await s
    .from("crm_leads")
    .select("id")
    .eq("business_id", website.business_id)
    .eq("phone", input.phone)
    .maybeSingle();
  if (!existing) {
    await s.from("crm_leads").insert({
      business_id: website.business_id,
      name: input.name,
      phone: input.phone,
      status: "new",
      source: "store",
      notes: `הזמין/ה בחנות: ${input.quantity}× ${product.name}${variantSuffix}${input.notes ? ` — ${input.notes}` : ""}`,
    });
  }

  // Best-effort email to the owner (no-op until RESEND_API_KEY is set).
  await notifyOwner(
    website.business_id,
    `הזמנה חדשה: ${input.quantity}× ${product.name}`,
    `התקבלה הזמנה חדשה בחנות שלך:<br><br>
     <b>מוצר:</b> ${input.quantity}× ${escapeHtml(product.name)}${escapeHtml(variantSuffix)}<br>
     <b>לקוח:</b> ${escapeHtml(input.name)}<br>
     <b>טלפון:</b> ${escapeHtml(input.phone)}<br>
     ${input.notes ? `<b>הערות:</b> ${escapeHtml(input.notes)}<br>` : ""}
     <br>היכנס ללוח הבקרה כדי לאשר את ההזמנה.`,
  );

  // This phone completed checkout — clear any abandoned-cart follow-up.
  await recoverAbandonedCart(website.business_id, input.phone);

  return { ok: true };
}

/**
 * Creates a multi-item (cart) order from the public site. Resolves the
 * published site → business, validates every line against active products,
 * snapshots names + effective prices, inserts an order header + order_items,
 * and fires the same CRM task / lead / owner-email side effects as a single
 * order — with a cart summary instead of one product.
 */
export async function createPublicCartOrder(
  slug: string,
  input: {
    items: CartLine[];
    name: string;
    phone: string;
    email?: string | null;
    address?: string | null;
    notes?: string | null;
    couponCode?: string | null;
    customerUserId?: string | null;
    paymentMethod?: string | null;
    shippingMethodId?: string | null;
    shippingRegion?: string | null;
    shippingPoint?: string | null;
    redeemPoints?: boolean;
    referralCode?: string | null;
    // When true, the order is created in a PENDING (awaiting-payment) state and
    // ALL fulfillment side effects (CRM lead/task, owner email, stock decrement,
    // loyalty/referral) are skipped — they run later in finalizePaidStoreOrder
    // once the Stripe webhook confirms payment. Returns the order id + amount.
    awaitingPayment?: boolean;
  },
): Promise<{ ok: boolean; error?: string; orderId?: string; amount?: number }> {
  const s = createServiceRoleClient();

  if (!input.items?.length) return { ok: false, error: "הסל ריק" };

  const { data: website } = await s
    .from("websites")
    .select("business_id")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (!website) return { ok: false, error: "החנות אינה זמינה כרגע" };

  // Only a 'store' site that has not switched its checkout off sells. The cart
  // UI is already gone on the other two modes and on a catalog-only store
  // (app/s/[slug]/page.tsx), but the checkout action is a public POST — a
  // hand-crafted request must not be able to place an order on a brochure
  // site, a landing page or a shop window.
  const { data: sellingBusiness } = await s
    .from("businesses")
    .select("site_mode, catalog_only")
    .eq("id", website.business_id)
    .maybeSingle();
  if (
    !sellsOnline(sellingBusiness?.site_mode, {
      catalogOnly: sellingBusiness?.catalog_only,
    })
  ) {
    return { ok: false, error: "החנות אינה זמינה כרגע" };
  }

  // Fetch all referenced products in one go (active + this business only).
  const ids = [...new Set(input.items.map((i) => i.productId))];
  const { data: products } = await s
    .from("products")
    .select("id,name,price,sale_price,in_stock,track_inventory,preorder,engraving")
    .eq("business_id", website.business_id)
    .eq("active", true)
    .in("id", ids);
  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  // Variants for any inventory-tracked product in the cart.
  const trackedIds = (products ?? []).filter((p) => p.track_inventory).map((p) => p.id);
  const variantById = new Map<
    string,
    { id: string; product_id: string; stock_qty: number; size: string | null; color: string | null }
  >();
  if (trackedIds.length > 0) {
    const { data: variants } = await s
      .from("product_variants")
      .select("id,product_id,stock_qty,size,color")
      .in("product_id", trackedIds);
    for (const v of variants ?? []) variantById.set(v.id, v);
  }

  // Build validated line items with price snapshots; track per-variant decrements.
  const lines: {
    product_id: string;
    variant_id: string | null;
    product_name: string;
    variant: string | null;
    quantity: number;
    unit_price: number | null;
    engraving: string | null;
  }[] = [];
  const decrements: { variantId: string; qty: number; allowNegative: boolean }[] = [];
  let total = 0;
  let totalQty = 0;
  for (const line of input.items) {
    const p = byId.get(line.productId);
    if (!p) return { ok: false, error: "אחד המוצרים אינו זמין יותר" };
    const qty = Math.min(99, Math.max(1, Math.floor(Number(line.quantity) || 1)));

    let variantId: string | null = null;
    if (p.track_inventory) {
      // Inventory-tracked: a variant must be chosen and have stock (unless pre-order).
      const v = line.variantId ? variantById.get(line.variantId) : undefined;
      if (!v || v.product_id !== p.id) {
        return { ok: false, error: `${p.name}: יש לבחור וריאציה` };
      }
      if (!p.preorder && v.stock_qty < qty) {
        return { ok: false, error: `${p.name} אזל מהמלאי בוריאציה שנבחרה` };
      }
      variantId = v.id;
      decrements.push({ variantId: v.id, qty, allowNegative: !!p.preorder });
    } else if (p.in_stock === false) {
      if (!p.preorder) return { ok: false, error: `${p.name} אזל מהמלאי` };
    }

    const unit =
      p.sale_price != null && p.price != null && Number(p.sale_price) < Number(p.price)
        ? Number(p.sale_price)
        : p.price != null
          ? Number(p.price)
          : null;
    if (unit != null) total += unit * qty;
    totalQty += qty;

    // 128 leaves room for two joined fields (couple sets: "שם 1 | שם 2").
    const engravingText = line.engraving?.trim().slice(0, 128) || null;
    if (isEngravingRequired(p.engraving) && !engravingText) {
      return { ok: false, error: `חסר טקסט לחריטה עבור ${p.name}` };
    }

    lines.push({
      product_id: p.id,
      variant_id: variantId,
      product_name: p.name,
      variant: line.variant?.trim() || null,
      quantity: qty,
      unit_price: unit,
      engraving: engravingText,
    });
  }

  const summary = `סל: ${totalQty} פריטים (${lines.length} מוצרים)`;

  // Coupon: re-validate server-side and discount the merchandise subtotal.
  // Instant/free methods redeem (bump used_count) right away, same as before.
  // Card orders only PEEK the discount here — the use is committed later in
  // finalizePaidStoreOrder once the payment actually clears, so an abandoned
  // or failed card checkout never consumes a coupon use. The applied code is
  // persisted on the order either way (orders.coupon_code) so it can be
  // committed/released later.
  const { discount, code: appliedCoupon } = input.awaitingPayment
    ? await peekCouponDiscount(website.business_id, input.couponCode, total, { phone: input.phone })
    : await redeemCoupon(website.business_id, input.couponCode, total, { phone: input.phone });
  const discountedSubtotal = Math.max(0, total - discount);

  // Loyalty redemption: if the signed-in shopper opts to redeem, convert points
  // to a discount on the (post-coupon) merchandise. Earn happens after insert.
  // Instant/free methods DEBIT the points here, atomically — same peek/commit
  // split as the coupon above (card orders defer the debit to
  // finalizePaidStoreOrder, and don't offer redemption today anyway).
  const { data: loyaltyBiz } = await s
    .from("businesses")
    .select("loyalty_enabled, loyalty_value")
    .eq("id", website.business_id)
    .maybeSingle();
  const loyaltyEnabled = !!loyaltyBiz?.loyalty_enabled;
  const loyaltyValue = Number(loyaltyBiz?.loyalty_value ?? 0) || 0;
  let loyaltyDiscount = 0;
  let pointsUsed = 0;
  if (input.redeemPoints && input.customerUserId && loyaltyEnabled && loyaltyValue > 0) {
    const balance = await getBalanceServiceRole(website.business_id, input.customerUserId);
    const maxValue = balance * loyaltyValue;
    loyaltyDiscount = Math.min(maxValue, discountedSubtotal);
    pointsUsed = Math.min(balance, Math.round(loyaltyDiscount / loyaltyValue));
    // The read above is only a hint. Commit the spend NOW, before the total is
    // locked into the order row, with a guarded UPDATE that only matches while
    // the balance still covers the whole redemption. Debiting after the insert
    // (as this used to) let two carts submitted in the same second both take
    // the full discount — the second debit was absorbed by the RPC's
    // greatest(0, ...) clamp and the merchant ate the difference. Losing the
    // race just means no loyalty discount on this order; refunded below if the
    // order then fails to save.
    if (pointsUsed > 0 && !input.awaitingPayment) {
      const spent = await redeemPointsAtomic(
        website.business_id,
        input.customerUserId,
        pointsUsed,
      );
      if (!spent) {
        loyaltyDiscount = 0;
        pointsUsed = 0;
      }
    }
  }
  const merchAfter = Math.max(0, discountedSubtotal - loyaltyDiscount);

  // Shipping. If the shopper chose a defined shipping method, price it from that
  // method (server-authoritative); otherwise fall back to the legacy flat fee.
  let shipping = 0;
  let shippingMethodName: string | null = null;
  let shippingDetail: string | null = null;
  if (input.shippingMethodId) {
    const { data: method } = await s
      .from("shipping_methods")
      .select("*")
      .eq("id", input.shippingMethodId)
      .eq("business_id", website.business_id)
      .eq("active", true)
      .maybeSingle();
    if (!method) return { ok: false, error: "שיטת המשלוח אינה זמינה" };
    const resolved = resolveShipping(
      method,
      { region: input.shippingRegion, point: input.shippingPoint },
      merchAfter,
    );
    if (!resolved) return { ok: false, error: "נא לבחור אזור/נקודת איסוף תקינים" };
    shipping = resolved.price;
    shippingMethodName = method.name;
    shippingDetail = resolved.detail;
    // Server-authoritative address requirement: any ship-to-customer method
    // needs a real address (the client enforces this too, but never trust it).
    if (
      method.type !== "pickup" &&
      method.type !== "pickup_point" &&
      (input.address ?? "").trim().length < 5
    ) {
      return { ok: false, error: "נדרשת כתובת מלאה למשלוח" };
    }
  } else {
    const { data: biz } = await s
      .from("businesses")
      .select("shipping_fee, free_shipping_threshold")
      .eq("id", website.business_id)
      .maybeSingle();
    const fee = Number(biz?.shipping_fee ?? 0) || 0;
    const threshold =
      biz?.free_shipping_threshold != null ? Number(biz.free_shipping_threshold) : null;
    const qualifiesFree = threshold != null && threshold > 0 && merchAfter >= threshold;
    shipping = merchAfter > 0 && fee > 0 && !qualifiesFree ? fee : 0;
    // Legacy flat-fee stores ship physical goods — require an address whenever
    // a shipping fee is configured (even if this order crossed the free bar).
    if (fee > 0 && (input.address ?? "").trim().length < 5) {
      return { ok: false, error: "נדרשת כתובת מלאה למשלוח" };
    }
  }
  const grandTotal = merchAfter + shipping;

  // Insert the order header, then the line items.
  const { data: order, error: orderErr } = await s
    .from("orders")
    .insert({
      business_id: website.business_id,
      product_id: lines[0].product_id,
      product_name: summary,
      quantity: totalQty,
      total: grandTotal || null,
      customer_name: input.name,
      customer_phone: input.phone,
      customer_address: input.address || null,
      customer_user_id: input.customerUserId || null,
      payment_method: input.paymentMethod || null,
      shipping_method: shippingMethodName,
      shipping_price: shippingMethodName ? shipping : null,
      shipping_details: shippingDetail,
      notes: input.notes || null,
      coupon_code: appliedCoupon,
      referral_code: input.referralCode || null,
      points_used: pointsUsed,
      // Instant/free methods (COD/bank-transfer/Bit) are final the moment
      // placed — stock is decremented and the coupon redeemed right below,
      // unconditionally. Mark payment_status "paid" now (instead of leaving
      // it at the schema default "pending") so a later cancellation correctly
      // releases that stock/coupon via setOrderStatus's payment_status==="paid"
      // gate. Card orders overwrite this to "pending" just below.
      payment_status: "paid",
    })
    .select("id")
    .single();
  if (orderErr || !order) {
    // Instant/free path already committed the coupon use and debited the
    // redeemed points above — give both back so a failed insert doesn't
    // silently burn the shopper's coupon or balance.
    if (!input.awaitingPayment && appliedCoupon) {
      await releaseCouponRedemption(website.business_id, appliedCoupon);
    }
    if (!input.awaitingPayment && pointsUsed > 0 && input.customerUserId) {
      await refundRedeemedPoints(website.business_id, input.customerUserId, pointsUsed);
    }
    return { ok: false, error: "השמירה נכשלה — נסו שוב" };
  }

  const { error: itemsErr } = await s.from("order_items").insert(
    lines.map((l) => ({ ...l, order_id: order.id, business_id: website.business_id })),
  );
  if (itemsErr) {
    // Roll back the orphaned header (it was inserted payment_status='paid' with
    // no items) and release the coupon + redeemed points so nothing is left
    // half-committed.
    await s.from("orders").delete().eq("id", order.id);
    if (!input.awaitingPayment && appliedCoupon) {
      await releaseCouponRedemption(website.business_id, appliedCoupon);
    }
    if (!input.awaitingPayment && pointsUsed > 0 && input.customerUserId) {
      await refundRedeemedPoints(website.business_id, input.customerUserId, pointsUsed);
    }
    return { ok: false, error: "השמירה נכשלה — נסו שוב" };
  }

  // Card/Stripe path: stop here with a PENDING order. Fulfillment side effects
  // (stock, loyalty, coupon redemption, referral, owner notification) run on
  // payment confirmation (finalizePaidStoreOrder). No CRM lead/task is created
  // — a self-service paid sale needs no follow-up.
  if (input.awaitingPayment) {
    await s
      .from("orders")
      .update({ payment_method: input.paymentMethod || "card", payment_status: "pending" })
      .eq("id", order.id);
    return { ok: true, orderId: order.id, amount: grandTotal };
  }

  // Loyalty earn + referral crediting — shared with the card-payment path,
  // which runs the same helper from finalizePaidStoreOrder on webhook.
  // pointsUsed is 0 here on purpose: the spend was already committed
  // atomically above, when the discount was decided. Only the card path still
  // has a spend left to settle at fulfillment time.
  await awardOrderLoyaltyAndReferral({
    businessId: website.business_id,
    customerUserId: input.customerUserId ?? null,
    phone: input.phone,
    merchAmount: merchAfter,
    pointsUsed: 0,
    referralCode: input.referralCode,
  });

  // Decrement variant stock atomically (a single guarded UPDATE per variant via
  // the decrement_variant_stock RPC — never blocks the placed order). Stock can
  // go negative on pre-order (allowNegative) — the owner reconciles when
  // restocking. Any genuine shortfall (non-preorder, lost the race to another
  // order) is flagged in the owner notification below instead of blocking.
  const insufficientVariantIds = new Set<string>();
  if (decrements.length > 0) {
    const merged = new Map<string, { qty: number; allowNegative: boolean }>();
    for (const d of decrements) {
      const cur = merged.get(d.variantId);
      merged.set(d.variantId, {
        qty: (cur?.qty ?? 0) + d.qty,
        allowNegative: cur?.allowNegative || d.allowNegative,
      });
    }
    await Promise.all(
      [...merged.entries()].map(async ([variantId, { qty, allowNegative }]) => {
        const { data: ok } = await s.rpc("decrement_variant_stock", {
          p_variant_id: variantId,
          p_qty: qty,
          p_allow_negative: allowNegative,
        });
        if (!ok && !allowNegative) insufficientVariantIds.add(variantId);
      }),
    );
    // If every variant of a tracked product is now ≤0, flip the product to out-of-stock.
    const productIds = [...new Set(lines.filter((l) => l.variant_id).map((l) => l.product_id))];
    for (const pid of productIds) {
      const { data: vs } = await s
        .from("product_variants")
        .select("stock_qty")
        .eq("product_id", pid);
      const anyLeft = (vs ?? []).some((v) => Number(v.stock_qty) > 0);
      await s.from("products").update({ in_stock: anyLeft }).eq("id", pid);
    }
  }
  const insufficientNames = lines
    .filter((l) => l.variant_id && insufficientVariantIds.has(l.variant_id))
    .map((l) => `${l.product_name}${l.variant ? ` (${l.variant})` : ""}`);

  // Owner task (due today, Israel time) + CRM lead (dedupe by phone).
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const itemsText = lines
    .map(
      (l) =>
        `${l.quantity}× ${l.product_name}${l.variant ? ` (${l.variant})` : ""}${l.engraving ? ` — חריטה: ${l.engraving}` : ""}`,
    )
    .join(", ");
  await s.from("crm_tasks").insert({
    business_id: website.business_id,
    title: `הזמנה חדשה (${summary}) — ${input.name} (${input.phone})`,
    priority: "high",
    due_date: today,
  });

  const { data: existing } = await s
    .from("crm_leads")
    .select("id")
    .eq("business_id", website.business_id)
    .eq("phone", input.phone)
    .maybeSingle();
  if (!existing) {
    await s.from("crm_leads").insert({
      business_id: website.business_id,
      name: input.name,
      phone: input.phone,
      status: "new",
      source: "store",
      notes: `הזמין/ה בחנות: ${itemsText}`,
    });
  }

  await notifyOwner(
    website.business_id,
    `הזמנה חדשה בחנות (${totalQty} פריטים)`,
    `${insufficientNames.length ? `<b style="color:#b45309">⚠️ שימו לב: המלאי לא הספיק במלואו עבור: ${insufficientNames.join(", ")} — כדאי לבדוק לפני המשלוח.</b><br><br>` : ""}התקבלה הזמנה חדשה בחנות שלך:<br><br>
     <b>פריטים:</b><br>${lines
       .map(
         (l) =>
           `• ${l.quantity}× ${escapeHtml(l.product_name)}${l.variant ? ` (${escapeHtml(l.variant)})` : ""}${l.engraving ? ` — חריטה: ${escapeHtml(l.engraving)}` : ""}`,
       )
       .join("<br>")}<br><br>
     ${total ? `<b>מוצרים:</b> ₪${total.toLocaleString("he-IL")}<br>` : ""}
     ${discount > 0 ? `<b>הנחה${appliedCoupon ? ` (${escapeHtml(appliedCoupon)})` : ""}:</b> −₪${discount.toLocaleString("he-IL")}<br>` : ""}
     ${shipping > 0 || shippingMethodName ? `<b>משלוח${shippingMethodName ? ` (${escapeHtml(shippingMethodName)}${shippingDetail ? ` · ${escapeHtml(shippingDetail)}` : ""})` : ""}:</b> ${shipping === 0 ? "חינם" : `₪${shipping.toLocaleString("he-IL")}`}<br>` : ""}
     ${grandTotal ? `<b>סה"כ לתשלום:</b> ₪${grandTotal.toLocaleString("he-IL")}<br>` : ""}
     <b>לקוח:</b> ${escapeHtml(input.name)}<br>
     <b>טלפון:</b> ${escapeHtml(input.phone)}<br>
     ${input.address ? `<b>כתובת:</b> ${escapeHtml(input.address)}<br>` : ""}
     ${input.notes ? `<b>הערות:</b> ${escapeHtml(input.notes)}<br>` : ""}
     <br>היכנס ללוח הבקרה כדי לאשר את ההזמנה.`,
  );

  // This phone completed checkout — clear any abandoned-cart follow-up.
  await recoverAbandonedCart(website.business_id, input.phone);

  // Customer order-confirmation email (best-effort) when an email was provided.
  if (input.email) {
    const { data: bizName } = await s
      .from("businesses").select("name").eq("id", website.business_id).maybeSingle();
    await sendOrderConfirmationEmail(input.email, {
      businessName: bizName?.name ?? "החנות",
      itemsText: lines
        .map((l) => `${l.quantity}× ${l.product_name}${l.engraving ? ` — חריטה: ${l.engraving}` : ""}`)
        .join("<br>"),
      totalText: grandTotal ? `₪${grandTotal.toLocaleString("he-IL")}` : "—",
      address: input.address,
      shipping: shippingMethodName,
    });
  }

  return { ok: true };
}
