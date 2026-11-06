import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { toRange } from "@/lib/services/pagination";
import type { Return } from "@/types/database";

const TZ = "Asia/Jerusalem";

/** Standard page size for the returns "טען עוד" pagination. */
export const RETURNS_PAGE_SIZE = 50;

// ── Owner-side (RLS) ────────────────────────────────────────────────────────

/** Latest returns/exchanges, newest first, paged ~RETURNS_PAGE_SIZE at a time. */
export async function listReturns(businessId: string, opts?: { page?: number }): Promise<Return[]> {
  const [from, to] = toRange(opts?.page ?? 1, RETURNS_PAGE_SIZE);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("returns")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function setReturnStatus(id: string, status: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("returns").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Public (service role, scoped to published sites) ───────────────────────

/**
 * Creates a return/exchange request from the public site (/s/[slug]):
 * resolves the published website → business, inserts a returns row, and
 * creates a high-priority CRM task (due today, Israel time) for the owner.
 */
export async function createReturnRequest(
  slug: string,
  input: {
    name: string;
    phone: string;
    item?: string | null;
    reason?: string | null;
    kind: "return" | "exchange";
  },
): Promise<{ ok: boolean; error?: string }> {
  const s = createServiceRoleClient();

  const { data: website } = await s
    .from("websites")
    .select("business_id")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (!website) return { ok: false, error: "האתר אינו זמין כרגע" };

  const { error } = await s.from("returns").insert({
    business_id: website.business_id,
    customer_name: input.name,
    customer_phone: input.phone,
    item: input.item || null,
    reason: input.reason || null,
    kind: input.kind,
  });
  if (error) return { ok: false, error: "השמירה נכשלה — נסו שוב" };

  // Owner gets a high-priority task to handle the request (due today, Israel time).
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const kindLabel = input.kind === "exchange" ? "החלפה" : "החזרה";
  await s.from("crm_tasks").insert({
    business_id: website.business_id,
    title: `בקשת ${kindLabel}: ${input.item || "פריט"} — ${input.name} (${input.phone})`,
    priority: "high",
    due_date: today,
  });

  return { ok: true };
}
