import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { escapeHtml } from "@/lib/email-templates";
import { notifyOwner } from "@/lib/services/email.service";
import type { Quote, QuoteItem, TablesInsert, TablesUpdate } from "@/types/database";
import type { Palette } from "@/lib/storefront-brand";

const TZ = "Asia/Jerusalem";

// ── Owner-side (RLS) ────────────────────────────────────────────────────────

export async function listQuotes(businessId: string): Promise<Quote[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  // items is jsonb — always written as QuoteItem[] (lib/actions/quotes.ts
  // sanitize()), so this is a read-boundary cast, not a real gap.
  return (data ?? []) as Quote[];
}

export async function createQuote(
  businessId: string,
  input: Omit<TablesInsert<"quotes">, "business_id">,
): Promise<Quote> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .insert({ ...input, business_id: businessId })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create quote");
  return data as Quote;
}

export async function updateQuote(id: string, fields: TablesUpdate<"quotes">): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").update(fields).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteQuote(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Public (service role, scoped by token) ──────────────────────────────────

export type PublicQuote = {
  id: string;
  title: string;
  customerName: string;
  items: QuoteItem[];
  notes: string | null;
  discount: number;
  taxRate: number;
  validUntil: string | null;
  status: string;
  businessName: string;
  paymentLink: string | null;
  whatsappPhone: string | null;
  colorPalette: Palette | null;
  logoUrl: string | null;
};

/**
 * Loads a quote for the public view by its token. Drafts are never exposed —
 * only a quote the owner has actually sent (or that's already been answered).
 */
export async function getPublicQuote(token: string): Promise<PublicQuote | null> {
  const s = createServiceRoleClient();
  const { data: quote } = await s
    .from("quotes")
    .select("*")
    .eq("public_token", token)
    .neq("status", "draft")
    .maybeSingle();
  if (!quote) return null;

  const { data: business } = await s
    .from("businesses")
    .select("name,payment_link")
    .eq("id", quote.business_id)
    .maybeSingle();

  const { data: brand } = await s
    .from("brand_assets")
    .select("color_palette,logo_url")
    .eq("business_id", quote.business_id)
    .maybeSingle();

  const { data: wa } = await s
    .from("whatsapp_config")
    .select("display_phone")
    .eq("business_id", quote.business_id)
    .maybeSingle();

  return {
    id: quote.id,
    title: quote.title,
    customerName: quote.customer_name,
    items: (quote.items as QuoteItem[] | null) ?? [],
    notes: quote.notes,
    discount: quote.discount,
    taxRate: quote.tax_rate,
    validUntil: quote.valid_until,
    status: quote.status,
    businessName: business?.name ?? "העסק",
    paymentLink: business?.payment_link ?? null,
    whatsappPhone: wa?.display_phone ?? null,
    // jsonb: an array of {name, hex, usage} objects — NOT plain colour strings.
    // It was typed as string[] here, so the public quote page interpolated an
    // object into a CSS colour and the brand accent silently never rendered.
    colorPalette: (brand?.color_palette as Palette | null) ?? null,
    logoUrl: brand?.logo_url ?? null,
  };
}

/**
 * Customer response from the public link. Only a 'sent' quote can be answered
 * (idempotent — re-answering an already-decided quote is rejected). On accept,
 * stamps accepted_at and drops a high-priority CRM task for the owner.
 */
export async function respondToQuote(
  token: string,
  decision: "accepted" | "declined",
): Promise<{ ok: boolean; error?: string }> {
  const s = createServiceRoleClient();

  const { data: quote } = await s
    .from("quotes")
    .select("id,business_id,title,customer_name,customer_phone,status")
    .eq("public_token", token)
    .maybeSingle();
  if (!quote) return { ok: false, error: "ההצעה לא נמצאה" };
  if (quote.status === "draft") return { ok: false, error: "ההצעה אינה זמינה" };
  if (quote.status !== "sent") {
    return { ok: false, error: "כבר הגבתם להצעה הזו" };
  }

  const { error } = await s
    .from("quotes")
    .update({
      status: decision,
      accepted_at: decision === "accepted" ? new Date().toISOString() : null,
    })
    .eq("id", quote.id);
  if (error) return { ok: false, error: "השמירה נכשלה — נסו שוב" };

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const phone = quote.customer_phone ? ` (${quote.customer_phone})` : "";
  await s.from("crm_tasks").insert({
    business_id: quote.business_id,
    title:
      decision === "accepted"
        ? `הצעת מחיר אושרה: "${quote.title}" — ${quote.customer_name}${phone}`
        : `הצעת מחיר נדחתה: "${quote.title}" — ${quote.customer_name}${phone}`,
    priority: decision === "accepted" ? "high" : "low",
    due_date: today,
  });

  // Best-effort email to the owner (no-op until RESEND_API_KEY is set).
  await notifyOwner(
    quote.business_id,
    decision === "accepted"
      ? `הצעת מחיר אושרה: "${quote.title}"`
      : `הצעת מחיר נדחתה: "${quote.title}"`,
    decision === "accepted"
      ? `הלקוח <b>${escapeHtml(String(quote.customer_name ?? ""))}</b>${escapeHtml(phone)} אישר את הצעת המחיר "<b>${escapeHtml(String(quote.title ?? ""))}</b>". 🎉<br><br>היכנס ללוח הבקרה כדי להמשיך.`
      : `הלקוח <b>${escapeHtml(String(quote.customer_name ?? ""))}</b>${escapeHtml(phone)} דחה את הצעת המחיר "<b>${escapeHtml(String(quote.title ?? ""))}</b>".`,
  );

  return { ok: true };
}
