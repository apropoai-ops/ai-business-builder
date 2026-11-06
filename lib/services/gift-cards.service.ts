import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { GiftCard } from "@/types/database";

/**
 * Gift-card issuing & tracking for a business. Owner-facing operations run
 * through the RLS client (createClient); the public storefront count uses the
 * service-role client so it works for anonymous visitors.
 *
 * No real payment is processed here — issuing a card simply mints a unique code
 * and records its balance. Redemption/charging is out of scope for this module.
 */

/** Builds a code like "GC-7K2P9A" — uppercase, easy to read aloud. */
function generateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no easily-confused 0/O/1/I
  let body = "";
  for (let i = 0; i < 6; i++) {
    body += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `GC-${body}`;
}

// ── Owner (RLS) ─────────────────────────────────────────────────────────────

export async function listGiftCards(businessId: string): Promise<GiftCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gift_cards")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Issues a new gift card: mints a code that's unique within the business,
 * seeds the balance to the full amount, and marks it active. Retries on the
 * (rare) chance of a code collision before giving up.
 */
export async function issueGiftCard(
  businessId: string,
  fields: { amount: number; recipient_name?: string | null },
): Promise<{ card?: GiftCard; error?: string }> {
  const supabase = await createClient();
  const recipient = fields.recipient_name?.trim() || null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { data, error } = await supabase
      .from("gift_cards")
      .insert({
        business_id: businessId,
        code,
        initial_amount: fields.amount,
        balance: fields.amount,
        recipient_name: recipient,
        status: "active",
      })
      .select("*")
      .single();
    if (!error && data) return { card: data };
    // 23505 = unique violation → another card grabbed this code; retry.
    if (error && error.code !== "23505") return { error: error.message };
  }
  return { error: "יצירת קוד ייחודי נכשלה, נסו שוב" };
}

export async function deactivateGiftCard(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("gift_cards")
    .update({ status: "inactive" })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Public (service role) ───────────────────────────────────────────────────

/** Counts active gift cards for a business — drives the public promo's visibility. */
export async function countActiveGiftCards(businessId: string): Promise<number> {
  const s = createServiceRoleClient();
  const { count, error } = await s
    .from("gift_cards")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("status", "active");
  if (error) return 0;
  return count ?? 0;
}
