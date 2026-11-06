import { createClient } from "@/lib/supabase/server";
import { invoiceFromGross } from "@/lib/payments";
import type { Order, OrderInvoice, OrderRefund } from "@/types/database";

/**
 * Owner-side store-payments service (RLS via the owner's session). Covers
 * payment settings, marking orders paid, issuing Israeli tax invoices and
 * recording refunds / credit notes. Public checkout payment config travels with
 * getPublicSiteBySlug; the actual charge processor (Stripe) is layered later.
 */

export type BankDetails = {
  bank?: string;
  branch?: string;
  account?: string;
  holder?: string;
};

export type PaymentSettingsInput = {
  methods: string[];
  bank: BankDetails;
  bitPhone: string | null;
  paypalLink: string | null;
  cardLink: string | null;
  taxId: string | null;
  vatRate: number;
};

export async function setPaymentSettings(
  businessId: string,
  input: PaymentSettingsInput,
): Promise<void> {
  const supabase = await createClient();
  const hasBank = Object.values(input.bank).some((v) => v && v.trim());
  const { error } = await supabase
    .from("businesses")
    .update({
      payment_methods: input.methods,
      bank_details: hasBank ? input.bank : null,
      bit_phone: input.bitPhone || null,
      paypal_link: input.paypalLink || null,
      payment_link: input.cardLink || null,
      business_tax_id: input.taxId || null,
      vat_rate: input.vatRate,
    })
    .eq("id", businessId);
  if (error) throw new Error(error.message);
}

export async function setOrderPaymentStatus(
  orderId: string,
  status: "pending" | "paid" | "failed",
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({
      payment_status: status,
      paid_at: status === "paid" ? new Date().toISOString() : null,
    })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
}

// ── Tax invoices ────────────────────────────────────────────────────────────

export async function listInvoices(businessId: string): Promise<OrderInvoice[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("order_invoices")
    .select("*")
    .eq("business_id", businessId)
    .order("issued_at", { ascending: false });
  return data ?? [];
}

export async function getInvoiceByOrder(
  orderId: string,
): Promise<OrderInvoice | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("order_invoices")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();
  return data ?? null;
}

/**
 * Issues a tax invoice for an order (idempotent — returns the existing one if
 * already issued). Numbers come from the next_invoice_number(business_id) SQL
 * RPC, which bumps businesses.next_invoice_number with a single atomic
 * UPDATE...RETURNING — avoiding the race between two concurrent "issue
 * invoice" calls reusing the same number that a read-then-write bump risked.
 */
export async function issueInvoice(
  businessId: string,
  orderId: string,
): Promise<{ ok: boolean; invoice?: OrderInvoice; error?: string }> {
  const supabase = await createClient();

  const existing = await getInvoiceByOrder(orderId);
  if (existing) return { ok: true, invoice: existing };

  const { data: order } = await supabase
    .from("orders")
    .select("id, business_id, total, customer_name")
    .eq("id", orderId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!order) return { ok: false, error: "ההזמנה לא נמצאה" };
  if (order.total == null || Number(order.total) <= 0) {
    return { ok: false, error: "אין סכום לחיוב בהזמנה זו" };
  }

  const { data: biz } = await supabase
    .from("businesses")
    .select("vat_rate")
    .eq("id", businessId)
    .maybeSingle();
  const vatRate = Number(biz?.vat_rate ?? 18);

  const { data: numberResult, error: numErr } = await supabase.rpc("next_invoice_number", {
    p_business_id: businessId,
  });
  if (numErr || numberResult == null) return { ok: false, error: "הפקת מספר החשבונית נכשלה" };
  const number = Number(numberResult);

  const { data: items } = await supabase
    .from("order_items")
    .select("product_name, variant, quantity, unit_price")
    .eq("order_id", orderId);

  const { net, vat, gross } = invoiceFromGross(Number(order.total), vatRate);

  const { data: invoice, error } = await supabase
    .from("order_invoices")
    .insert({
      business_id: businessId,
      order_id: orderId,
      invoice_number: String(number),
      customer_name: order.customer_name,
      subtotal: net,
      discount: 0,
      vat_rate: vatRate,
      vat_amount: vat,
      total: gross,
      lines: items ?? [],
    })
    .select("*")
    .single();
  if (error || !invoice) return { ok: false, error: "הפקת החשבונית נכשלה" };

  return { ok: true, invoice };
}

// ── Refunds / credit notes ──────────────────────────────────────────────────

export async function listRefunds(businessId: string): Promise<OrderRefund[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("order_refunds")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/**
 * Records a refund against an order and updates the order's payment_status to
 * refunded / partially_refunded based on the cumulative refunded amount.
 */
export async function createRefund(
  businessId: string,
  orderId: string,
  amount: number,
  reason: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, total")
    .eq("id", orderId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!order) return { ok: false, error: "ההזמנה לא נמצאה" };

  // Cap the refund at the order total minus what was already refunded — a typo
  // (1000 instead of 100) or a double refund must not corrupt the books.
  const { data: prior } = await supabase
    .from("order_refunds")
    .select("amount")
    .eq("order_id", orderId);
  const alreadyRefunded = (prior ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const orderTotal = Number(order.total ?? 0);
  if (orderTotal > 0 && amount + alreadyRefunded > orderTotal + 0.01) {
    const remaining = Math.max(0, orderTotal - alreadyRefunded);
    return {
      ok: false,
      error: `סכום הזיכוי חורג מסכום ההזמנה — ניתן לזכות עוד עד ₪${remaining.toLocaleString()}`,
    };
  }

  const { error: insErr } = await supabase.from("order_refunds").insert({
    business_id: businessId,
    order_id: orderId,
    amount,
    reason: reason || null,
    status: "done",
  });
  if (insErr) return { ok: false, error: "רישום הזיכוי נכשל" };

  // Sum all refunds for this order to decide full vs partial.
  const { data: refunds } = await supabase
    .from("order_refunds")
    .select("amount")
    .eq("order_id", orderId);
  const refunded = (refunds ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const total = Number(order.total ?? 0);
  const status = total > 0 && refunded >= total ? "refunded" : "partially_refunded";

  await supabase.from("orders").update({ payment_status: status }).eq("id", orderId);
  return { ok: true };
}

/** Refunds grouped by order id, for the owner orders view. */
export async function listRefundsByOrder(
  businessId: string,
): Promise<Record<string, OrderRefund[]>> {
  const refunds = await listRefunds(businessId);
  const map: Record<string, OrderRefund[]> = {};
  for (const r of refunds) (map[r.order_id] ??= []).push(r);
  return map;
}

export type { Order };
