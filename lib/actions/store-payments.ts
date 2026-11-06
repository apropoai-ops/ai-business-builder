"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { parseEnabledMethods } from "@/lib/payments";
import {
  setPaymentSettings,
  setOrderPaymentStatus,
  issueInvoice,
  createRefund,
} from "@/lib/services/store-payments.service";
import { getPlanForBusiness } from "@/lib/quota";
import { assertFeature } from "@/lib/entitlements";

type Result = { ok: boolean; error?: string };

function revalidateStore(businessId: string) {
  revalidatePath(`/businesses/${businessId}/store`);
  revalidatePath(`/businesses/${businessId}/orders`);
}

/** Owner saves which payment methods the storefront accepts + their details. */
export async function savePaymentSettingsAction(
  businessId: string,
  input: {
    methods: string[];
    bank: { bank?: string; branch?: string; account?: string; holder?: string };
    bitPhone: string;
    paypalLink: string;
    cardLink: string;
    taxId: string;
    vatRate: string;
  },
): Promise<Result> {
  await requireUser();
  const plan = await getPlanForBusiness(businessId);
  try {
    assertFeature(plan, "store_full");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "שגיאה" };
  }

  const methods = parseEnabledMethods(input.methods);
  const vatRate = input.vatRate.trim() ? Number(input.vatRate) : 18;
  if (isNaN(vatRate) || vatRate < 0 || vatRate > 100) {
    return { ok: false, error: "אחוז מע״מ לא תקין" };
  }
  const link = input.cardLink.trim();
  if (link && !/^https?:\/\//i.test(link)) {
    return { ok: false, error: "לינק תשלום חייב להתחיל ב-http(s)" };
  }
  const paypal = input.paypalLink.trim();
  if (paypal && !/^https?:\/\//i.test(paypal)) {
    return { ok: false, error: "לינק PayPal חייב להתחיל ב-http(s)" };
  }

  try {
    await setPaymentSettings(businessId, {
      methods,
      bank: {
        bank: input.bank.bank?.trim() || undefined,
        branch: input.bank.branch?.trim() || undefined,
        account: input.bank.account?.trim() || undefined,
        holder: input.bank.holder?.trim() || undefined,
      },
      bitPhone: input.bitPhone.trim() || null,
      paypalLink: paypal || null,
      cardLink: link || null,
      taxId: input.taxId.trim() || null,
      vatRate,
    });
    revalidateStore(businessId);
    return { ok: true };
  } catch {
    return { ok: false, error: "השמירה נכשלה — נסו שוב" };
  }
}

export async function markOrderPaidAction(
  businessId: string,
  orderId: string,
  paid: boolean,
): Promise<Result> {
  await requireUser();
  try {
    await setOrderPaymentStatus(orderId, paid ? "paid" : "pending");
    revalidatePath(`/businesses/${businessId}/orders`);
    return { ok: true };
  } catch {
    return { ok: false, error: "העדכון נכשל" };
  }
}

export async function issueInvoiceAction(
  businessId: string,
  orderId: string,
): Promise<{ ok: boolean; invoiceId?: string; error?: string }> {
  await requireUser();
  const res = await issueInvoice(businessId, orderId);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath(`/businesses/${businessId}/orders`);
  return { ok: true, invoiceId: res.invoice?.id };
}

export async function refundOrderAction(
  businessId: string,
  orderId: string,
  amount: number,
  reason: string,
): Promise<Result> {
  await requireUser();
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return { ok: false, error: "סכום זיכוי לא תקין" };
  }
  const res = await createRefund(businessId, orderId, amt, reason.trim() || null);
  if (!res.ok) return res;
  revalidatePath(`/businesses/${businessId}/orders`);
  return { ok: true };
}
