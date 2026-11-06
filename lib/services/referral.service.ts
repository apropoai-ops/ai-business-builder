import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { adjustPoints } from "@/lib/services/loyalty.service";

/**
 * Referral program (חבר מביא חבר). Each shopper has a global referral_code.
 * When a referred shopper places their first order at a store (referral enabled),
 * the referrer earns loyalty points. Codes/awards are deduped per business.
 */

function genCode(): string {
  // 6 chars, unambiguous uppercase alphanumerics.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/** Returns the shopper's referral code, creating one on first request (RLS self). */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("customer_profiles")
    .select("referral_code")
    .eq("id", userId)
    .maybeSingle();
  if (existing?.referral_code) return existing.referral_code;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genCode();
    const { error } = await supabase
      .from("customer_profiles")
      .upsert({ id: userId, referral_code: code, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (!error) return code;
    // 23505 = unique violation on the code → try another.
  }
  return genCode();
}

/** How many successful referrals the shopper has made (RLS: own rows). */
export async function getReferralCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_user_id", userId);
  return count ?? 0;
}

/**
 * Credits a referrer when a referred shopper completes their first order at a
 * business (service role). Idempotent per (business, referred user). Returns the
 * points awarded (0 if invalid / self / already referred).
 */
export async function applyReferral(
  businessId: string,
  code: string,
  buyerUserId: string,
  buyerPhone: string | null,
  points: number,
): Promise<number> {
  const norm = code.trim().toUpperCase();
  if (!norm) return 0;
  const s = createServiceRoleClient();

  const { data: referrer } = await s
    .from("customer_profiles")
    .select("id")
    .eq("referral_code", norm)
    .maybeSingle();
  if (!referrer || referrer.id === buyerUserId) return 0;

  const { error } = await s.from("referrals").insert({
    business_id: businessId,
    referrer_user_id: referrer.id,
    referred_user_id: buyerUserId,
    referred_phone: buyerPhone,
    points_awarded: points,
  });
  if (error) return 0; // unique violation = already referred for this business

  if (points > 0) await adjustPoints(businessId, referrer.id, points);
  return points;
}
