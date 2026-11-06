"use server";

import { revalidatePath } from "next/cache";

import { getCustomerUser } from "@/lib/auth/customer";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  createAddress,
  updateAddress,
  deleteAddress,
  createPaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  upsertCustomerProfile,
  getCustomerProfile,
  getDefaultAddress,
} from "@/lib/services/customer-account.service";
import { getLoyaltyBalance } from "@/lib/services/loyalty.service";

type Result = { ok: boolean; error?: string };

/**
 * Checkout prefill for a signed-in shopper: their default saved address falls
 * back to their profile name/phone. Returns null for guests so checkout stays
 * unchanged for them.
 */
export async function getCheckoutPrefillAction(slug?: string): Promise<
  {
    name: string;
    phone: string;
    address: string;
    loggedIn: boolean;
    loyalty: { points: number; value: number } | null;
  } | null
> {
  const user = await getCustomerUser();
  if (!user) return null;

  const [addr, profile] = await Promise.all([
    getDefaultAddress(user.id),
    getCustomerProfile(user.id),
  ]);

  const name =
    addr?.recipient_name ||
    profile?.full_name ||
    (user.user_metadata?.full_name as string | undefined) ||
    "";
  const phone = addr?.phone || profile?.phone || "";
  const address = addr
    ? [addr.street, addr.city, addr.zip].filter(Boolean).join(", ")
    : "";

  // Loyalty balance for this specific store (if enabled).
  let loyalty: { points: number; value: number } | null = null;
  if (slug) {
    const s = createServiceRoleClient();
    const { data: site } = await s
      .from("websites")
      .select("business_id")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle();
    if (site) {
      const { data: biz } = await s
        .from("businesses")
        .select("loyalty_enabled, loyalty_value")
        .eq("id", site.business_id)
        .maybeSingle();
      if (biz?.loyalty_enabled) {
        const points = await getLoyaltyBalance(site.business_id, user.id);
        if (points > 0) loyalty = { points, value: Number(biz.loyalty_value) || 0 };
      }
    }
  }

  return { name, phone, address, loggedIn: true, loyalty };
}

async function requireAuth(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const user = await getCustomerUser();
  if (!user) return { ok: false, error: "יש להתחבר תחילה" };
  return { ok: true, userId: user.id };
}

function clean(v: FormDataEntryValue | null, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}

// ── Profile ─────────────────────────────────────────────────────────────────

export async function saveCustomerProfileAction(
  slug: string,
  formData: FormData,
): Promise<Result> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;

  const full_name = clean(formData.get("full_name"), 120) || null;
  const phone = clean(formData.get("phone"), 40) || null;

  try {
    await upsertCustomerProfile(auth.userId, { full_name, phone });
    revalidatePath(`/s/${slug}/account`);
    return { ok: true };
  } catch {
    return { ok: false, error: "השמירה נכשלה — נסו שוב" };
  }
}

// ── Addresses ───────────────────────────────────────────────────────────────

function parseAddress(formData: FormData) {
  const recipient_name = clean(formData.get("recipient_name"), 120);
  const phone = clean(formData.get("phone"), 40);
  const street = clean(formData.get("street"), 200);
  const city = clean(formData.get("city"), 100);
  const zip = clean(formData.get("zip"), 20) || null;
  const label = clean(formData.get("label"), 40) || null;
  const notes = clean(formData.get("notes"), 300) || null;
  const is_default = formData.get("is_default") === "on" || formData.get("is_default") === "true";

  if (recipient_name.length < 2) return { error: "נא להזין שם נמען" };
  if (phone.replace(/\D/g, "").length < 9) return { error: "נא להזין טלפון תקין" };
  if (street.length < 2) return { error: "נא להזין כתובת" };
  if (city.length < 2) return { error: "נא להזין עיר" };

  return {
    value: { recipient_name, phone, street, city, zip, label, notes, is_default },
  };
}

export async function saveAddressAction(
  slug: string,
  addressId: string | null,
  formData: FormData,
): Promise<Result> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;

  const parsed = parseAddress(formData);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  try {
    if (addressId) await updateAddress(auth.userId, addressId, parsed.value);
    else await createAddress(auth.userId, parsed.value);
    revalidatePath(`/s/${slug}/account/addresses`);
    revalidatePath(`/s/${slug}/account`);
    return { ok: true };
  } catch {
    return { ok: false, error: "השמירה נכשלה — נסו שוב" };
  }
}

export async function deleteAddressAction(
  slug: string,
  addressId: string,
): Promise<Result> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await deleteAddress(auth.userId, addressId);
    revalidatePath(`/s/${slug}/account/addresses`);
    return { ok: true };
  } catch {
    return { ok: false, error: "המחיקה נכשלה — נסו שוב" };
  }
}

// ── Payment methods (display metadata only — Wave A) ─────────────────────────

export async function savePaymentMethodAction(
  slug: string,
  formData: FormData,
): Promise<Result> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;

  const brand = clean(formData.get("brand"), 40) || null;
  // last4: keep digits only, max 4. NEVER accept a full card number.
  const last4Raw = clean(formData.get("last4"), 19).replace(/\D/g, "");
  if (last4Raw.length > 4) {
    return { ok: false, error: "נא להזין רק 4 ספרות אחרונות של הכרטיס" };
  }
  const last4 = last4Raw || null;
  const exp_month = Number(formData.get("exp_month")) || null;
  const exp_year = Number(formData.get("exp_year")) || null;
  const label = clean(formData.get("label"), 40) || null;
  const is_default = formData.get("is_default") === "on" || formData.get("is_default") === "true";

  if (exp_month != null && (exp_month < 1 || exp_month > 12)) {
    return { ok: false, error: "חודש תפוגה לא תקין" };
  }

  try {
    await createPaymentMethod(auth.userId, {
      brand,
      last4,
      exp_month,
      exp_year,
      label,
      is_default,
    });
    revalidatePath(`/s/${slug}/account/payment-methods`);
    return { ok: true };
  } catch {
    return { ok: false, error: "השמירה נכשלה — נסו שוב" };
  }
}

export async function deletePaymentMethodAction(
  slug: string,
  id: string,
): Promise<Result> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await deletePaymentMethod(auth.userId, id);
    revalidatePath(`/s/${slug}/account/payment-methods`);
    return { ok: true };
  } catch {
    return { ok: false, error: "המחיקה נכשלה — נסו שוב" };
  }
}

export async function setDefaultPaymentMethodAction(
  slug: string,
  id: string,
): Promise<Result> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await setDefaultPaymentMethod(auth.userId, id);
    revalidatePath(`/s/${slug}/account/payment-methods`);
    return { ok: true };
  } catch {
    return { ok: false, error: "הפעולה נכשלה — נסו שוב" };
  }
}
