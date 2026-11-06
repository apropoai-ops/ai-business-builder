"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  createQuote,
  updateQuote,
  deleteQuote,
  respondToQuote,
} from "@/lib/services/quotes.service";
import { getPlanForBusiness } from "@/lib/quota";
import { assertFeature } from "@/lib/entitlements";
import type { QuoteItem, TablesInsert } from "@/types/database";

type QuoteFields = Omit<TablesInsert<"quotes">, "business_id">;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type QuoteInput = {
  title: string;
  customerName: string;
  customerPhone?: string;
  items: QuoteItem[];
  notes?: string;
  discount?: number;
  taxRate?: number;
  validUntil?: string | null;
  status?: "draft" | "sent";
};

function sanitize(input: QuoteInput): { fields?: QuoteFields; error?: string } {
  const title = input.title?.trim().slice(0, 160);
  const customerName = input.customerName?.trim().slice(0, 120);
  if (!title || title.length < 2) return { error: "נא למלא כותרת להצעה" };
  if (!customerName || customerName.length < 2) return { error: "נא למלא שם לקוח" };

  const items: QuoteItem[] = (input.items ?? [])
    .map((it) => ({
      description: String(it?.description ?? "").trim().slice(0, 200),
      quantity: Math.round(Number(it?.quantity)),
      unit_price: Number(it?.unit_price),
    }))
    .filter(
      (it) =>
        it.description.length > 0 &&
        Number.isFinite(it.quantity) &&
        it.quantity > 0 &&
        Number.isFinite(it.unit_price) &&
        it.unit_price >= 0,
    );
  if (items.length === 0) return { error: "נא להוסיף לפחות שורת פריט אחת" };
  if (items.length > 50) return { error: "יותר מדי שורות (עד 50)" };

  const discount = Math.max(0, Number(input.discount) || 0);
  const taxRateRaw = input.taxRate;
  const taxRate =
    taxRateRaw === undefined || taxRateRaw === null || !Number.isFinite(Number(taxRateRaw))
      ? 18
      : Math.min(100, Math.max(0, Number(taxRateRaw)));

  const validUntil = input.validUntil && input.validUntil.length >= 8 ? input.validUntil : null;
  const notes = input.notes?.trim().slice(0, 1000) || null;
  const customerPhone = input.customerPhone?.trim().slice(0, 40) || null;
  const status = input.status === "sent" ? "sent" : "draft";

  return {
    fields: {
      title,
      customer_name: customerName,
      customer_phone: customerPhone,
      items,
      notes,
      discount,
      tax_rate: taxRate,
      valid_until: validUntil,
      status,
    },
  };
}

// ── Owner actions ───────────────────────────────────────────────────────────

export async function createQuoteAction(
  businessId: string,
  input: QuoteInput,
): Promise<{ id?: string; error?: string }> {
  await requireUser();
  const { fields, error } = sanitize(input);
  if (error) return { error };
  try {
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "quotes");
    const quote = await createQuote(businessId, fields!);
    revalidatePath(`/businesses/${businessId}/quotes`);
    return { id: quote.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

export async function updateQuoteAction(
  businessId: string,
  quoteId: string,
  input: QuoteInput,
): Promise<{ error?: string }> {
  await requireUser();
  const { fields, error } = sanitize(input);
  if (error) return { error };
  try {
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "quotes");
    await updateQuote(quoteId, fields!);
    revalidatePath(`/businesses/${businessId}/quotes`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

export async function setQuoteStatusAction(
  businessId: string,
  quoteId: string,
  status: "draft" | "sent",
): Promise<{ error?: string }> {
  await requireUser();
  if (status !== "draft" && status !== "sent") return { error: "סטטוס לא תקין" };
  try {
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "quotes");
    await updateQuote(quoteId, { status });
    revalidatePath(`/businesses/${businessId}/quotes`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

export async function deleteQuoteAction(
  businessId: string,
  quoteId: string,
): Promise<{ error?: string }> {
  await requireUser();
  try {
    const plan = await getPlanForBusiness(businessId);
    assertFeature(plan, "quotes");
    await deleteQuote(quoteId);
    revalidatePath(`/businesses/${businessId}/quotes`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה" };
  }
}

// ── Public action (anonymous customer on /q/[token]) ───────────────────────

export async function respondToQuoteAction(
  token: string,
  decision: "accepted" | "declined",
): Promise<{ ok: boolean; error?: string }> {
  if (!token || !UUID_RE.test(token)) return { ok: false, error: "הקישור אינו תקף" };
  if (decision !== "accepted" && decision !== "declined") {
    return { ok: false, error: "בחירה לא תקינה" };
  }
  if (!(await checkRateLimit(`quote:${token}`, 10, 3600))) {
    return { ok: false, error: "יותר מדי ניסיונות כרגע — נסו שוב מאוחר יותר" };
  }
  return respondToQuote(token, decision);
}
