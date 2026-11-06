import { createServiceRoleClient } from "@/lib/supabase/server";
import { getActiveIntegration } from "@/lib/services/integrations/credentials";
import { sendEmail, emailConfigured } from "@/lib/services/email.service";
import { emailShell } from "@/lib/email-templates";
import type { InvoicingDriver, IssueDocumentArgs, InvoiceLine } from "./types";
import { greenInvoiceDriver } from "./providers/green-invoice";
import { icountDriver } from "./providers/icount";

/**
 * Israeli invoicing orchestration — issues a tax document (חשבונית מס/קבלה)
 * for a paid store order via whichever provider (Green Invoice / iCount) the
 * owner has connected under the "invoicing" integration category. No-op when
 * nothing is connected. NEVER throws — this runs inline in payment
 * confirmation flows (checkout / Stripe webhook) and must not break them.
 */

const DRIVERS: Record<string, InvoicingDriver> = {
  "green-invoice": greenInvoiceDriver,
  icount: icountDriver,
};

/**
 * Issues (or best-effort skips/logs) a document for a paid order. Idempotent:
 * a second call for the same order is a silent no-op once a row already
 * exists in external_invoices (issued OR failed — a failed attempt is not
 * silently retried on every webhook redelivery; the owner can see it and
 * reconnect/retry manually via a future "retry" action if needed).
 */
export async function issueInvoiceForPaidOrder(orderId: string): Promise<void> {
  try {
    const s = createServiceRoleClient();

    const { data: existing } = await s
      .from("external_invoices")
      .select("id")
      .eq("order_id", orderId)
      .limit(1)
      .maybeSingle();
    if (existing) return; // already attempted — never re-issue

    const { data: order } = await s
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return;

    const active = await getActiveIntegration(order.business_id, "invoicing");
    if (!active) return; // no invoicing integration connected — silent no-op

    const driver = DRIVERS[active.provider];
    if (!driver) return;

    const { data: business } = await s
      .from("businesses")
      .select("name, business_tax_id, vat_rate")
      .eq("id", order.business_id)
      .maybeSingle();
    if (!business) return;

    const { data: items } = await s
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    const orderTotal = Number(order.total ?? 0) || 0;

    const lines: InvoiceLine[] =
      items && items.length > 0
        ? items.map((it) => ({
            description: it.variant ? `${it.product_name} (${it.variant})` : it.product_name,
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.unit_price ?? 0) || 0,
          }))
        : [
            {
              description: order.variant ? `${order.product_name} (${order.variant})` : order.product_name,
              quantity: Number(order.quantity) || 1,
              unitPrice: orderTotal,
            },
          ];

    /*
     * A tax document whose lines don't add up to the money actually taken is
     * either rejected by the provider or — worse — filed for the wrong amount.
     * `order_items` holds ONLY product rows: shipping is added straight into
     * orders.total and coupon/loyalty discounts are subtracted from it, so the
     * itemised branch above under-bills every order that carries any of them
     * (a delivery fee alone is enough, which makes this the common case).
     *
     * Shipping is a real column, so it becomes a real line. Everything still
     * unaccounted for is booked as one balancing discount line — computed as a
     * residual rather than re-derived, because the coupon's VALUE is not stored
     * (only its code) and loyalty redemption is stored in points, not shekels.
     * The residual is exact by construction, which is what the tax document
     * needs.
     */
    if (items && items.length > 0) {
      const round2 = (n: number) => Math.round(n * 100) / 100;
      const itemsSum = round2(lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0));
      const shipping = round2(Number(order.shipping_price ?? 0) || 0);

      if (shipping > 0) {
        lines.push({ description: "משלוח", quantity: 1, unitPrice: shipping });
      }

      const residual = round2(orderTotal - itemsSum - shipping);
      if (residual !== 0) {
        const label = residual < 0
          ? order.coupon_code
            ? `הנחה (${order.coupon_code})`
            : "הנחה"
          : "התאמה";
        lines.push({ description: label, quantity: 1, unitPrice: residual });
      }
    }

    const email = await resolveCustomerEmail(s, order.business_id, order.customer_user_id, order.customer_phone);

    const args: IssueDocumentArgs = {
      business: {
        name: business.name ?? "העסק",
        taxId: business.business_tax_id,
        vatRate: Number(business.vat_rate ?? 18) || 18,
      },
      customer: {
        name: order.customer_name,
        email,
        phone: order.customer_phone,
      },
      lines,
      total: Number(order.total ?? 0) || 0,
      paymentMethod: order.payment_method,
      orderId: order.id,
    };

    try {
      const doc = await driver.issueDocument(args, active.credentials);
      await s.from("external_invoices").insert({
        business_id: order.business_id,
        order_id: order.id,
        provider: active.provider,
        doc_type: doc.docType,
        external_id: doc.externalId,
        number: doc.number,
        url: doc.url,
        status: "issued",
      });

      if (email && emailConfigured()) {
        const subject = `חשבונית מס' ${doc.number} — ${business.name ?? ""}`;
        const body = `
          <p style="font-size:16px">מצורף קישור לחשבונית עבור ההזמנה שלך אצל <b>${business.name ?? ""}</b>.</p>
          <p><b>מספר מסמך:</b> ${doc.number}</p>
          ${doc.url ? `<div style="margin:20px 0;text-align:center"><a href="${doc.url}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 22px;border-radius:10px;font-weight:700;text-decoration:none">צפייה בחשבונית</a></div>` : ""}
          <p style="color:#71717a">תודה על הרכישה!</p>`;
        await sendEmail({ to: email, subject, html: emailShell(subject, body) }).catch(() => {});
      }
    } catch (err) {
      await s.from("external_invoices").insert({
        business_id: order.business_id,
        order_id: order.id,
        provider: active.provider,
        doc_type: "invoice_receipt",
        status: "failed",
        error: err instanceof Error ? err.message : "שגיאה לא ידועה בהפקת החשבונית",
      });
    }
  } catch {
    // never throw — invoicing must never break a payment confirmation flow
  }
}

/**
 * The most recent successfully-issued external document for an order, for
 * display on the owner order view / customer order-tracking page. Returns
 * null when none was issued (no integration connected, or issuance failed).
 */
export async function getExternalInvoiceForOrder(
  orderId: string,
): Promise<{ number: string; url: string | null; provider: string } | null> {
  try {
    const s = createServiceRoleClient();
    const { data } = await s
      .from("external_invoices")
      .select("number, url, provider, status, created_at")
      .eq("order_id", orderId)
      .eq("status", "issued")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data?.number) return null;
    return { number: data.number, url: data.url, provider: data.provider };
  } catch {
    return null;
  }
}

/**
 * Bulk variant for the owner orders screen — all successfully-issued
 * documents for a business keyed by order id, one query.
 */
export async function listExternalInvoicesByOrder(
  businessId: string,
): Promise<Record<string, { number: string; url: string | null; provider: string }>> {
  const byOrder: Record<string, { number: string; url: string | null; provider: string }> = {};
  try {
    const s = createServiceRoleClient();
    const { data } = await s
      .from("external_invoices")
      .select("order_id, number, url, provider, created_at")
      .eq("business_id", businessId)
      .eq("status", "issued")
      .order("created_at", { ascending: true });
    for (const row of data ?? []) {
      if (row.order_id && row.number) {
        byOrder[row.order_id] = { number: row.number, url: row.url, provider: row.provider };
      }
    }
  } catch {
    // best-effort — the orders screen renders fine without external doc links
  }
  return byOrder;
}

/**
 * Best-effort customer email lookup — orders don't persist an email column
 * (checkout collects it transiently for the order-confirmation email), so we
 * try the logged-in customer's auth email first, then fall back to a
 * matching CRM contact by phone.
 */
async function resolveCustomerEmail(
  s: ReturnType<typeof createServiceRoleClient>,
  businessId: string,
  customerUserId: string | null,
  customerPhone: string | null,
): Promise<string | null> {
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
