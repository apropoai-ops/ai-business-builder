import Stripe from "stripe";

import { escapeHtml } from "@/lib/email-templates";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { notifyOwner, sendOrderConfirmationEmail } from "@/lib/services/email.service";
import { awardOrderLoyaltyAndReferral, estimateOrderMerchAmount } from "@/lib/services/orders.service";
import { commitCouponRedemption } from "@/lib/services/coupon.service";
import { getActiveGateway, hasActiveGateway } from "@/lib/services/payment-connections.service";
import { issueInvoiceForPaidOrder } from "@/lib/services/invoicing";
import { fireAutomations } from "@/lib/services/automations.service";
import { finalizeRentalBooking } from "@/lib/services/rentals.service";

/**
 * On-site card payments for STOREFRONT orders (a shopper paying a business),
 * via Stripe Checkout. Distinct from the platform subscription billing in
 * billing.service. Built test-mode-first per the defer-paid rule: works with
 * the platform's Stripe TEST keys today; flipping to Live (and the
 * merchant-payout model — Stripe Connect or per-merchant keys) is the only
 * paid go-live step.
 *
 * Flow: action creates a PENDING order → createStoreCheckoutSession → shopper
 * pays on Stripe → webhook (checkout.session.completed, metadata.kind=
 * 'store_order') → finalizePaidStoreOrder marks it paid + fulfills.
 */

export function isStoreCardConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

async function businessIdForSlug(slug: string): Promise<string | null> {
  const s = createServiceRoleClient();
  const { data } = await s
    .from("websites").select("business_id").eq("slug", slug).maybeSingle();
  return data?.business_id ?? null;
}

/**
 * Whether the storefront can take on-site card payments for this slug — true if
 * the merchant connected their own Israeli gateway OR the platform Stripe
 * fallback is configured. Used to decide showing the "pay by card" option.
 */
export async function storeCardEnabledBySlug(slug: string): Promise<boolean> {
  if (isStoreCardConfigured()) return true;
  const businessId = await businessIdForSlug(slug);
  return businessId ? hasActiveGateway(businessId) : false;
}

/**
 * Routes a pending storefront order to its payment page: the merchant's own
 * connected gateway when one is active (money goes DIRECTLY to the merchant),
 * otherwise the platform Stripe Checkout fallback. Returns the hosted-payment
 * redirect URL. Direct-to-merchant gateways get a callback at
 * /api/payments/{provider}/callback?b={businessId} that finalizes the order.
 */
export async function createStorePaymentRedirect(args: {
  slug: string;
  orderId: string;
  amount: number;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
}): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const businessId = await businessIdForSlug(args.slug);

  if (businessId) {
    const active = await getActiveGateway(businessId);
    if (active) {
      const { data: business } = await createServiceRoleClient()
        .from("businesses").select("name").eq("id", businessId).maybeSingle();
      const { redirectUrl } = await active.driver.createCheckout(
        {
          orderId: args.orderId,
          amount: args.amount,
          description: `הזמנה מ-${business?.name ?? "החנות"}`,
          customerName: args.customerName,
          customerPhone: args.customerPhone,
          customerEmail: args.customerEmail,
          successUrl: `${appUrl}/s/${args.slug}?checkout=success`,
          cancelUrl: `${appUrl}/s/${args.slug}?checkout=cancel`,
          callbackUrl: `${appUrl}/api/payments/${active.provider}/callback?b=${businessId}`,
        },
        active.credentials,
      );
      return redirectUrl;
    }
  }

  // Fallback: platform Stripe Checkout.
  return createStoreCheckoutSession({
    slug: args.slug,
    orderId: args.orderId,
    amount: args.amount,
    customerEmail: args.customerEmail,
  });
}

function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("סליקת האשראי עוד לא הופעלה");
  return new Stripe(key);
}

/**
 * Creates a Stripe Checkout Session for a pending storefront order and returns
 * the hosted-checkout URL to redirect the shopper to.
 */
export async function createStoreCheckoutSession(args: {
  slug: string;
  orderId: string;
  amount: number; // ILS, VAT-inclusive grand total
  customerEmail?: string | null;
}): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const amountAgorot = Math.round(args.amount * 100);
  if (!Number.isFinite(amountAgorot) || amountAgorot < 200) {
    throw new Error("סכום לא תקין לתשלום");
  }

  const s = createServiceRoleClient();
  const { data: website } = await s
    .from("websites")
    .select("business_id")
    .eq("slug", args.slug)
    .maybeSingle();
  if (!website) throw new Error("החנות אינה זמינה");
  const { data: business } = await s
    .from("businesses")
    .select("name")
    .eq("id", website.business_id)
    .maybeSingle();
  const storeName = business?.name ?? "החנות";

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "ils",
          unit_amount: amountAgorot,
          product_data: { name: `הזמנה מ-${storeName}` },
        },
      },
    ],
    customer_email: args.customerEmail || undefined,
    success_url: `${appUrl}/s/${args.slug}?checkout=success`,
    cancel_url: `${appUrl}/s/${args.slug}?checkout=cancel`,
    metadata: {
      kind: "store_order",
      order_id: args.orderId,
      business_id: website.business_id,
      slug: args.slug,
    },
  });
  if (!session.url) throw new Error("יצירת עמוד התשלום נכשלה");
  return session.url;
}

/**
 * Routes a pending rental booking (nights) to its payment page — the rental
 * twin of `createStorePaymentRedirect`, and for the same reason: a night is
 * something the business sells, so it must be payable through the merchant's
 * OWN connected gateway when there is one, with the platform Stripe fallback
 * behind it. Until this existed every booking went to platform Stripe even for
 * a business that had connected a gateway, which meant the merchant could not
 * be paid for nights at all.
 */
export async function createRentalPaymentRedirect(args: {
  slug: string;
  bookingId: string;
  amount: number;
  label: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
}): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const businessId = await businessIdForSlug(args.slug);

  if (businessId) {
    const active = await getActiveGateway(businessId);
    if (active) {
      const { redirectUrl } = await active.driver.createCheckout(
        {
          orderId: args.bookingId,
          amount: args.amount,
          description: args.label,
          customerName: args.customerName,
          customerPhone: args.customerPhone,
          customerEmail: args.customerEmail,
          successUrl: `${appUrl}/s/${args.slug}?checkout=success`,
          cancelUrl: `${appUrl}/s/${args.slug}?checkout=cancel`,
          callbackUrl: `${appUrl}/api/payments/${active.provider}/callback?b=${businessId}`,
        },
        active.credentials,
      );
      return redirectUrl;
    }
  }

  return createRentalCheckoutSession(args);
}

/**
 * Stripe Checkout session for a vacation-rental reservation (metadata
 * kind=rental_booking). Same platform-keys / test-mode model as the store one.
 */
export async function createRentalCheckoutSession(args: {
  slug: string;
  bookingId: string;
  amount: number;
  label: string;
  customerEmail?: string | null;
}): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const amountAgorot = Math.round(args.amount * 100);
  if (!Number.isFinite(amountAgorot) || amountAgorot < 200) {
    throw new Error("סכום לא תקין לתשלום");
  }
  const s = createServiceRoleClient();
  const { data: website } = await s
    .from("websites").select("business_id").eq("slug", args.slug).maybeSingle();
  if (!website) throw new Error("האתר אינו זמין");

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "ils",
          unit_amount: amountAgorot,
          product_data: { name: args.label },
        },
      },
    ],
    customer_email: args.customerEmail || undefined,
    success_url: `${appUrl}/s/${args.slug}?checkout=success`,
    cancel_url: `${appUrl}/s/${args.slug}?checkout=cancel`,
    metadata: {
      kind: "rental_booking",
      booking_id: args.bookingId,
      business_id: website.business_id,
      slug: args.slug,
    },
  });
  if (!session.url) throw new Error("יצירת עמוד התשלום נכשלה");
  return session.url;
}

/**
 * Marks a storefront order paid + confirmed and runs the deferred fulfillment
 * (loyalty-earn + referral credit, coupon redemption, variant stock
 * decrement, invoicing, automations, owner notification). Idempotent: a
 * second webhook delivery for an already-paid order is a no-op (the
 * payment_status==="paid" guard below short-circuits before any side effect
 * runs). Intentionally does NOT create a CRM lead/task — a completed
 * self-service purchase needs no follow-up.
 *
 * `reportedAmount`, when the payment gateway's callback exposed one (ILS,
 * VAT-inclusive), is cross-checked against the order's stored total before
 * finalizing — on a mismatch beyond a small tolerance the order is NOT marked
 * paid; it's flagged in its notes and the owner is alerted to check manually.
 */
export async function finalizePaidStoreOrder(
  orderId: string,
  customerEmail?: string | null,
  reportedAmount?: number | null,
  expectedBusinessId?: string,
): Promise<void> {
  const s = createServiceRoleClient();

  const { data: order } = await s
    .from("orders")
    .select(
      "id, business_id, payment_status, total, quantity, customer_name, customer_address, shipping_method, shipping_price, customer_phone, customer_user_id, coupon_code, referral_code, points_used, notes",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.payment_status === "paid") return; // unknown or already done
  // Cross-tenant guard: the callback was verified with ONE business's gateway
  // credentials, so it may only settle that business's orders. Without this an
  // owner could run a real (self-paid) transaction on their own terminal with
  // ReturnValue = another store's order id and get that store to ship.
  if (expectedBusinessId && order.business_id !== expectedBusinessId) return;

  // Amount cross-check (only when the driver actually exposed one). A mismatch
  // means the callback might be forged/stale/for a different amount — don't
  // silently finalize; flag the order and let the owner verify manually.
  if (reportedAmount != null && order.total != null) {
    const expected = Number(order.total);
    if (Math.abs(expected - reportedAmount) > 1) {
      const flagNote = `⚠️ אזהרת תשלום: הספק דיווח על סכום ₪${reportedAmount.toLocaleString("he-IL")} בעוד שסכום ההזמנה הוא ₪${expected.toLocaleString("he-IL")} — ההזמנה לא סומנה כשולמה אוטומטית, יש לבדוק ידנית מול הספק.`;
      await s
        .from("orders")
        .update({ notes: order.notes ? `${order.notes}\n${flagNote}` : flagNote })
        .eq("id", orderId);
      await notifyOwner(
        order.business_id,
        "⚠️ פער בסכום תשלום — נדרשת בדיקה ידנית",
        `התקבלה התראת תשלום עבור הזמנה, אך הסכום שדווח (₪${reportedAmount.toLocaleString("he-IL")}) אינו תואם את סכום ההזמנה (₪${expected.toLocaleString("he-IL")}).<br><br>ההזמנה <b>לא</b> סומנה כשולמה אוטומטית — יש לבדוק ידנית מול הספק לפני אישור המשלוח.`,
      );
      return;
    }
  }

  // Atomically claim the order: flip to paid ONLY if it is still unpaid, and
  // proceed with fulfillment only if THIS call won the flip. Two concurrent
  // callbacks (gateway retry + manual redelivery) that both read 'pending'
  // above can't both run the side effects below — the loser matches 0 rows.
  const { data: claimed } = await s
    .from("orders")
    .update({ payment_status: "paid", paid_at: new Date().toISOString(), status: "confirmed" })
    .eq("id", orderId)
    .neq("payment_status", "paid")
    .select("id");
  if (!claimed || claimed.length === 0) return; // another callback already finalized it

  // Invoicing + automations — CONSUME contracts, both never throw and no-op
  // until their respective features are configured for this business.
  await Promise.all([
    issueInvoiceForPaidOrder(orderId),
    fireAutomations(order.business_id, "order_paid", {
      orderId,
      total: order.total != null ? Math.round(Number(order.total) * 100) : null,
      customerName: order.customer_name,
      customerEmail: customerEmail ?? null,
      customerPhone: order.customer_phone,
    }),
  ]);

  // Coupon use, deferred from checkout time to now that payment cleared (a
  // no-op when the order carried no coupon).
  await commitCouponRedemption(order.business_id, order.coupon_code);

  // Loyalty-earn + spend + referral crediting (best-effort) — the same logic
  // the free-method (Bit/COD) path runs on order insert, deferred here until
  // payment is actually confirmed. Guarded by the payment_status==="paid"
  // early-return above, so a duplicate webhook delivery never double-awards.
  if (order.customer_user_id) {
    const merchAmount = await estimateOrderMerchAmount(order.business_id, {
      total: order.total,
      shipping_method: order.shipping_method,
      shipping_price: order.shipping_price,
    });
    await awardOrderLoyaltyAndReferral({
      businessId: order.business_id,
      customerUserId: order.customer_user_id,
      phone: order.customer_phone,
      merchAmount,
      pointsUsed: order.points_used ?? 0,
      referralCode: order.referral_code,
    });
  }

  // Decrement tracked-variant stock for the paid lines atomically (a single
  // guarded UPDATE per variant via the decrement_variant_stock RPC — never
  // blocks finalizing the payment). Pre-order lines are allowed to go
  // negative, matching the free-checkout path's behavior; any genuine
  // shortfall on a non-preorder line is flagged in the owner notification.
  const { data: items } = await s
    .from("order_items")
    .select("product_id, variant_id, quantity, product_name, engraving")
    .eq("order_id", orderId);

  const decrements = new Map<string, number>();
  for (const it of items ?? []) {
    if (it.variant_id) decrements.set(it.variant_id, (decrements.get(it.variant_id) ?? 0) + it.quantity);
  }

  const insufficientVariantIds = new Set<string>();
  if (decrements.size > 0) {
    const variantIds = [...decrements.keys()];
    const { data: variantRows } = await s
      .from("product_variants")
      .select("id, product_id")
      .in("id", variantIds);
    const productIdByVariant = new Map((variantRows ?? []).map((v) => [v.id, v.product_id]));
    const productIds = [...new Set((variantRows ?? []).map((v) => v.product_id))];
    const { data: productRows } = await s.from("products").select("id, preorder").in("id", productIds);
    const preorderByProduct = new Map((productRows ?? []).map((p) => [p.id, !!p.preorder]));

    await Promise.all(
      [...decrements.entries()].map(async ([variantId, qty]) => {
        const productId = productIdByVariant.get(variantId);
        const allowNegative = productId ? (preorderByProduct.get(productId) ?? false) : false;
        const { data: ok } = await s.rpc("decrement_variant_stock", {
          p_variant_id: variantId,
          p_qty: qty,
          p_allow_negative: allowNegative,
        });
        if (!ok && !allowNegative) insufficientVariantIds.add(variantId);
      }),
    );

    for (const pid of productIds) {
      const { data: vs } = await s
        .from("product_variants")
        .select("stock_qty")
        .eq("product_id", pid);
      const anyLeft = (vs ?? []).some((v) => Number(v.stock_qty) > 0);
      await s.from("products").update({ in_stock: anyLeft }).eq("id", pid);
    }
  }

  const totalText = order.total ? `₪${Number(order.total).toLocaleString("he-IL")}` : "";
  const itemsText = (items ?? [])
    .map(
      (it) =>
        `${it.quantity}× ${escapeHtml(String(it.product_name ?? ""))}${it.engraving ? ` · ✒️ חריטה: "${escapeHtml(it.engraving)}"` : ""}`,
    )
    .join("<br>");
  const hasEngraving = (items ?? []).some((it) => it.engraving);
  const insufficientNames = (items ?? [])
    .filter((it) => it.variant_id && insufficientVariantIds.has(it.variant_id))
    .map((it) => it.product_name);

  await notifyOwner(
    order.business_id,
    "התקבל תשלום חדש בחנות 🎉",
    `${insufficientNames.length ? `<b style="color:#b45309">⚠️ שימו לב: המלאי לא הספיק במלואו עבור: ${insufficientNames.join(", ")} — כדאי לבדוק לפני המשלוח.</b><br><br>` : ""}לקוח שילם בכרטיס אשראי באתר והשלים הזמנה.<br><br>
     <b>פריטים:</b><br>${itemsText}<br><br>
     ${totalText ? `<b>סכום ששולם:</b> ${totalText}<br>` : ""}
     ${order.customer_address ? `<b>כתובת:</b> ${escapeHtml(order.customer_address)}<br>` : ""}
     <br>ההזמנה סומנה כ"שולמה" ו"מאושרת" — אפשר לצאת למשלוח.`,
  );

  // Mirror the paid sale into the CRM: a high-priority task ("go fulfill")
  // and a lead (dedupe by phone, source "store") so the sale shows up in the
  // owner's CRM + notifications like every other funnel event.
  try {
    await s.from("crm_tasks").insert({
      business_id: order.business_id,
      title: `🛍️ מכירה חדשה שולמה: ${order.customer_name} — ${totalText || ""}`.trim(),
      priority: "high",
    });
    const { data: existingLead } = await s
      .from("crm_leads")
      .select("id")
      .eq("business_id", order.business_id)
      .eq("phone", order.customer_phone)
      .maybeSingle();
    if (!existingLead) {
      await s.from("crm_leads").insert({
        business_id: order.business_id,
        name: order.customer_name,
        phone: order.customer_phone,
        status: "qualified",
        source: "store",
        notes: `רכש/ה בתשלום מקוון: ${itemsText.replaceAll("<br>", " | ")}${totalText ? ` (${totalText})` : ""}`,
      });
    }
  } catch {
    // best-effort — CRM mirroring never blocks payment finalization
  }

  // Customer order-confirmation email (best-effort). Email comes from the
  // Stripe Checkout session. Needs RESEND_API_KEY + a verified sender domain to
  // reach arbitrary customers (onboarding@resend.dev only delivers to the
  // Resend account owner).
  if (customerEmail) {
    const { data: biz } = await s
      .from("businesses")
      .select("name")
      .eq("id", order.business_id)
      .maybeSingle();
    await sendOrderConfirmationEmail(customerEmail, {
      businessName: biz?.name ?? "החנות",
      itemsText,
      totalText: totalText || "—",
      address: order.customer_address,
      shipping: order.shipping_method,
      hasEngraving,
    });
  }
}

/**
 * Finalizes whatever a merchant-gateway callback just reported paid — a
 * storefront ORDER or a rental BOOKING. The gateway drivers carry a single
 * opaque `orderId` through the provider round-trip and get it back verbatim,
 * so the callback route cannot tell the two apart on its own; this resolves it
 * against the tables and dispatches.
 *
 * Before this existed the callback only ever tried `orders`, so a booking paid
 * through a connected gateway was verified, accepted, and then silently
 * dropped: no confirmation, no owner alert, and the dates never got blocked.
 *
 * Both branches are idempotent and both no-op on an id that matches neither
 * table, so a stale or replayed callback is harmless.
 */
export async function finalizePaidCheckout(
  id: string,
  customerEmail?: string | null,
  reportedAmount?: number | null,
  expectedBusinessId?: string,
): Promise<void> {
  const s = createServiceRoleClient();

  const { data: booking } = await s
    .from("rental_bookings")
    .select("id, business_id, total, guest_email")
    .eq("id", id)
    .maybeSingle();

  if (!booking) {
    await finalizePaidStoreOrder(id, customerEmail, reportedAmount, expectedBusinessId);
    return;
  }
  if (expectedBusinessId && booking.business_id !== expectedBusinessId) return;

  // Same cross-check the order path applies: a gateway reporting a different
  // amount than we recorded means forged/stale/mismatched — never auto-confirm
  // a stay on it, tell the owner to verify against the provider instead.
  if (reportedAmount != null && booking.total != null) {
    const expected = Number(booking.total);
    if (Math.abs(expected - reportedAmount) > 1) {
      await notifyOwner(
        booking.business_id,
        "⚠️ פער בסכום תשלום על הזמנת אירוח — נדרשת בדיקה ידנית",
        `התקבלה התראת תשלום על הזמנת לינה, אך הסכום שדווח (₪${reportedAmount.toLocaleString("he-IL")}) אינו תואם את סכום ההזמנה (₪${expected.toLocaleString("he-IL")}).<br><br>ההזמנה <b>לא</b> אושרה אוטומטית והתאריכים לא נחסמו — יש לבדוק ידנית מול הספק.`,
      );
      return;
    }
  }

  await finalizeRentalBooking(id, customerEmail ?? booking.guest_email);
}
