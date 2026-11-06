import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { escapeHtml } from "@/lib/email-templates";
import { notifyOwner, sendOrderConfirmationEmail } from "@/lib/services/email.service";
import {
  isDateStr,
  isRangeAvailable,
  nightsBetween,
  rentalTotal,
  todayIL,
} from "@/lib/rentals";
import type { RentalUnit, RentalBooking } from "@/types/database";

// ── Owner (RLS) ──────────────────────────────────────────────────────────────

export type UnitFields = {
  name: string;
  description: string | null;
  /** Cover photo — always mirrors images[0]. Kept for thumbnails and legacy reads. */
  image_url: string | null;
  /** Ordered gallery; index 0 is the cover. */
  images: string[] | null;
  nightly_price: number;
  max_guests: number;
  active: boolean;
};

export async function listUnits(businessId: string): Promise<RentalUnit[]> {
  const s = await createClient();
  const { data } = await s
    .from("rental_units")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function createUnit(businessId: string, f: UnitFields): Promise<{ error?: string }> {
  const s = await createClient();
  const { error } = await s.from("rental_units").insert({ business_id: businessId, ...f });
  return error ? { error: error.message } : {};
}

export async function updateUnit(id: string, f: Partial<UnitFields>): Promise<{ error?: string }> {
  const s = await createClient();
  const { error } = await s.from("rental_units").update(f).eq("id", id);
  return error ? { error: error.message } : {};
}

export async function deleteUnit(id: string): Promise<void> {
  const s = await createClient();
  await s.from("rental_units").delete().eq("id", id);
}

export type ReservationRow = RentalBooking & { unit_name: string };

export async function listReservations(businessId: string): Promise<ReservationRow[]> {
  const s = await createClient();
  const [{ data: bookings }, { data: units }] = await Promise.all([
    s.from("rental_bookings").select("*").eq("business_id", businessId)
      .order("check_in", { ascending: false }),
    s.from("rental_units").select("id, name").eq("business_id", businessId),
  ]);
  const nameById = new Map((units ?? []).map((u) => [u.id, u.name]));
  return (bookings ?? []).map((b) => ({ ...b, unit_name: nameById.get(b.unit_id) ?? "יחידה" }));
}

export async function setReservationStatus(
  id: string,
  status: "confirmed" | "cancelled",
): Promise<{ error?: string }> {
  const s = await createClient();
  const { error } = await s.from("rental_bookings").update({ status }).eq("id", id);
  return error ? { error: error.message } : {};
}

// ── Public (service role) ────────────────────────────────────────────────────

export type PublicUnit = RentalUnit & { bookedRanges: { check_in: string; check_out: string }[] };

/** Active units for a business + each unit's future booked (non-cancelled) ranges. */
export async function listPublicUnits(businessId: string): Promise<PublicUnit[]> {
  const s = createServiceRoleClient();
  const { data: units } = await s
    .from("rental_units")
    .select("*")
    .eq("business_id", businessId)
    .eq("active", true)
    .order("sort", { ascending: true });
  if (!units?.length) return [];

  const today = todayIL();
  const { data: bookings } = await s
    .from("rental_bookings")
    .select("unit_id, check_in, check_out")
    .in("unit_id", units.map((u) => u.id))
    .neq("status", "cancelled")
    .gte("check_out", today);

  const byUnit = new Map<string, { check_in: string; check_out: string }[]>();
  for (const b of bookings ?? []) {
    const arr = byUnit.get(b.unit_id) ?? [];
    arr.push({ check_in: b.check_in, check_out: b.check_out });
    byUnit.set(b.unit_id, arr);
  }
  return units.map((u) => ({ ...u, bookedRanges: byUnit.get(u.id) ?? [] }));
}

/**
 * Creates a PENDING reservation after server-side validation (dates valid,
 * not in the past, available — no overlap). Returns the booking id + total so
 * the action can open a Stripe checkout. Fulfillment happens on payment.
 */
export async function createPendingRentalBooking(
  slug: string,
  input: {
    unitId: string;
    checkIn: string;
    checkOut: string;
    guestName: string;
    guestPhone: string;
    guestEmail?: string | null;
    guests: number;
    customerUserId?: string | null;
    notes?: string | null;
  },
): Promise<{ ok: boolean; error?: string; bookingId?: string; total?: number; nights?: number }> {
  const s = createServiceRoleClient();

  if (!isDateStr(input.checkIn) || !isDateStr(input.checkOut)) {
    return { ok: false, error: "תאריכים לא תקינים" };
  }
  if (input.checkIn < todayIL()) return { ok: false, error: "לא ניתן להזמין תאריך שעבר" };
  const nights = nightsBetween(input.checkIn, input.checkOut);
  if (nights < 1) return { ok: false, error: "צ'ק-אאוט חייב להיות אחרי צ'ק-אין" };

  const { data: website } = await s
    .from("websites").select("business_id").eq("slug", slug).eq("published", true).maybeSingle();
  if (!website) return { ok: false, error: "האתר אינו זמין" };

  // A catalog-only site takes no money at all, nights included. Deliberately
  // NOT a modeHasCommerce check: nights are gated by the rentals entitlement,
  // not by the build mode, so a צימר on the brochure package must keep booking
  // (see lib/site-mode.ts) — only the owner's own catalog switch stops it.
  const { data: sellingBusiness } = await s
    .from("businesses")
    .select("catalog_only")
    .eq("id", website.business_id)
    .maybeSingle();
  if (sellingBusiness?.catalog_only) {
    return { ok: false, error: "האתר אינו זמין" };
  }

  const { data: unit } = await s
    .from("rental_units")
    .select("id, nightly_price, max_guests, active")
    .eq("id", input.unitId)
    .eq("business_id", website.business_id)
    .maybeSingle();
  if (!unit || !unit.active) return { ok: false, error: "היחידה אינה זמינה" };

  const guests = Math.max(1, Math.min(Number(input.guests) || 1, unit.max_guests));

  // Availability: no overlap with existing non-cancelled bookings.
  const { data: existing } = await s
    .from("rental_bookings")
    .select("check_in, check_out")
    .eq("unit_id", input.unitId)
    .neq("status", "cancelled")
    .gte("check_out", todayIL());
  if (!isRangeAvailable(input.checkIn, input.checkOut, existing ?? [])) {
    return { ok: false, error: "התאריכים שבחרת כבר תפוסים — נסה תאריכים אחרים" };
  }

  const total = rentalTotal(Number(unit.nightly_price), nights);

  const { data: booking, error } = await s
    .from("rental_bookings")
    .insert({
      business_id: website.business_id,
      unit_id: input.unitId,
      check_in: input.checkIn,
      check_out: input.checkOut,
      guest_name: input.guestName,
      guest_phone: input.guestPhone,
      guest_email: input.guestEmail || null,
      guests,
      nights,
      total,
      status: "pending",
      payment_status: "pending",
      customer_user_id: input.customerUserId || null,
      notes: input.notes || null,
    })
    .select("id")
    .single();
  if (error || !booking) {
    // 23P01 = the rental_bookings_no_overlap exclusion constraint fired — a
    // concurrent checkout took these dates between our read and the insert.
    if (error?.code === "23P01") {
      return { ok: false, error: "התאריכים שבחרת כבר תפוסים — נסה תאריכים אחרים" };
    }
    return { ok: false, error: "יצירת ההזמנה נכשלה" };
  }

  return { ok: true, bookingId: booking.id, total, nights };
}

/** Marks a reservation paid + confirmed and notifies owner + guest. Idempotent. */
export async function finalizeRentalBooking(
  bookingId: string,
  customerEmail?: string | null,
): Promise<void> {
  const s = createServiceRoleClient();
  const { data: b } = await s
    .from("rental_bookings")
    .select("id, business_id, unit_id, check_in, check_out, nights, total, guest_name, guest_phone, payment_status")
    .eq("id", bookingId)
    .maybeSingle();
  if (!b || b.payment_status === "paid") return;

  // Atomically claim the booking, same as finalizePaidStoreOrder: flip to paid
  // ONLY if it is still unpaid, and only proceed with owner/guest notifications
  // if THIS call won the flip. Two concurrent deliveries (webhook retry +
  // gateway callback) that both read non-'paid' above can't both notify —
  // the loser matches 0 rows.
  const { data: claimed } = await s
    .from("rental_bookings")
    .update({ payment_status: "paid", paid_at: new Date().toISOString(), status: "confirmed" })
    .eq("id", bookingId)
    .neq("payment_status", "paid")
    .select("id");
  if (!claimed || claimed.length === 0) return;

  const { data: unit } = await s
    .from("rental_units").select("name").eq("id", b.unit_id).maybeSingle();
  const unitName = unit?.name ?? "היחידה";
  const totalText = `₪${Number(b.total).toLocaleString("he-IL")}`;
  const stay = `${unitName} · ${b.check_in} → ${b.check_out} (${b.nights} לילות)`;

  await notifyOwner(
    b.business_id,
    "הזמנת אירוח חדשה שולמה 🏡",
    `התקבלה הזמנה ששולמה:<br><br><b>${escapeHtml(stay)}</b><br><b>אורח:</b> ${escapeHtml(b.guest_name ?? "")} (${escapeHtml(b.guest_phone ?? "")})<br><b>סכום:</b> ${totalText}<br><br>התאריכים נחסמו אוטומטית בלוח הזמינות.`,
  );

  if (customerEmail) {
    const { data: biz } = await s
      .from("businesses").select("name").eq("id", b.business_id).maybeSingle();
    await sendOrderConfirmationEmail(customerEmail, {
      businessName: biz?.name ?? "האירוח",
      itemsText: stay,
      totalText,
      address: null,
      shipping: null,
    });
  }
}
