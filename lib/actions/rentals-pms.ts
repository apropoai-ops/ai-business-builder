"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import { getPlanForBusiness, getActiveAddonsForBusiness } from "@/lib/quota";
import { assertFeature } from "@/lib/entitlements";
import { getWebsite } from "@/lib/services/website.service";
import { isDateStr, nightsBetween } from "@/lib/rentals";
import {
  blockUnit,
  cancelBooking,
  createManualBooking,
  deleteUnitType,
  loadBoard,
  saveUnitType,
  searchBookings,
  updateBooking,
  type PmsBooking,
} from "@/lib/services/rentals-pms.service";
import type { RentalBookingStatus } from "@/types/database";

/**
 * Server actions for "לוח לילות".
 *
 * Every one of them runs the same three gates before touching anything, in
 * this order and for three different reasons:
 *   1. `requireUser()`            — is anyone signed in at all
 *   2. `getBusiness(businessId)`  — RLS: does THIS user own THIS business
 *   3. `assertFeature(..rentals)` — is the business on a plan that includes it
 *
 * Gate 2 is the security boundary and it is not optional: the businessId
 * arrives from the client, so without it a signed-in owner of business A could
 * post business B's id and manage someone else's calendar. `getBusiness` reads
 * through the RLS client, so a business the caller has no claim on returns
 * null and the action stops there.
 */

type Result = { error?: string; bookingId?: string };

async function gate(businessId: string): Promise<{ error?: string; actor?: { id: string; name: string } }> {
  const { user, profile } = await requireUser();
  if (!(await getBusiness(businessId))) return { error: "העסק לא נמצא" };
  const plan = await getPlanForBusiness(businessId);
  assertFeature(plan, "rentals", await getActiveAddonsForBusiness(businessId));
  return {
    actor: {
      id: user.id,
      name: profile?.full_name?.trim() || user.email || "משתמש",
    },
  };
}

async function revalidateRentals(businessId: string) {
  revalidatePath(`/businesses/${businessId}/rentals`);
  revalidatePath(`/businesses/${businessId}/store`);
  const website = await getWebsite(businessId).catch(() => null);
  if (website?.slug) revalidatePath(`/s/${website.slug}`);
}

/* ── Availability (§5, §7) ─────────────────────────────────────────────────── */

/**
 * Live availability for a window, straight from the same rows the calendar
 * draws — so "the board says free" and "the search says available" can never
 * disagree. Read-only, and still only a proposal: the database has the final
 * word when the booking is actually written.
 */
export async function checkAvailabilityAction(
  businessId: string,
  checkIn: string,
  checkOut: string,
  guests = 1,
): Promise<{
  error?: string;
  nights?: number;
  units?: { id: string; name: string; code: string | null; image: string | null;
            typeName: string | null; maxGuests: number; nightly: number; total: number;
            amenities: string[] }[];
}> {
  const g = await gate(businessId);
  if (g.error) return { error: g.error };

  if (!isDateStr(checkIn) || !isDateStr(checkOut)) return { error: "תאריכים לא תקינים" };
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) return { error: "תאריך היציאה חייב להיות אחרי תאריך הכניסה" };

  const { units, bookings } = await loadBoard([businessId], checkIn, checkOut);
  const { findAvailableUnits } = await import("@/lib/rentals");
  const matches = findAvailableUnits(
    units,
    bookings.map((b) => ({
      unit_id: b.unit_id, check_in: b.check_in, check_out: b.check_out,
      status: b.status, kind: b.kind,
    })),
    checkIn,
    checkOut,
    guests,
  );

  return {
    nights,
    units: matches.map((m) => ({
      id: m.unit.id,
      name: m.unit.name,
      code: m.unit.code,
      image: m.unit.image_url,
      typeName: m.unit.type_name,
      maxGuests: m.unit.max_guests,
      nightly: Number(m.unit.nightly_price),
      total: m.total,
      amenities: m.unit.amenities ?? [],
    })),
  };
}

/* ── Bookings ──────────────────────────────────────────────────────────────── */

export async function createBookingAction(
  businessId: string,
  input: {
    unitId: string;
    checkIn: string;
    checkOut: string;
    guestName: string;
    guestPhone: string;
    guestEmail?: string;
    guests: number;
    pricePerNight?: number | null;
    total?: number | null;
    notes?: string;
    status?: "pending" | "confirmed";
  },
): Promise<Result> {
  const g = await gate(businessId);
  if (g.error || !g.actor) return { error: g.error };

  const guestName = input.guestName?.trim().slice(0, 120);
  const guestPhone = input.guestPhone?.trim().slice(0, 40);
  if (!guestName || guestName.length < 2) return { error: "נא למלא שם אורח" };
  if (!guestPhone || guestPhone.replace(/\D/g, "").length < 9) {
    return { error: "נא למלא מספר טלפון תקין" };
  }

  const res = await createManualBooking(
    {
      businessId,
      unitId: input.unitId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guestName,
      guestPhone,
      guestEmail: input.guestEmail?.trim().slice(0, 160) || null,
      guests: input.guests,
      pricePerNight: input.pricePerNight ?? null,
      total: input.total ?? null,
      notes: input.notes?.trim().slice(0, 1000) || null,
      status: input.status,
    },
    g.actor,
  );
  if (!res.error) await revalidateRentals(businessId);
  return res;
}

export async function updateBookingAction(
  businessId: string,
  bookingId: string,
  patch: {
    unitId?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: number;
    guestName?: string;
    guestPhone?: string;
    guestEmail?: string | null;
    pricePerNight?: number | null;
    total?: number | null;
    notes?: string | null;
    status?: RentalBookingStatus;
  },
): Promise<Result> {
  const g = await gate(businessId);
  if (g.error || !g.actor) return { error: g.error };
  const res = await updateBooking(businessId, bookingId, patch, g.actor);
  if (!res.error) await revalidateRentals(businessId);
  return res;
}

export async function cancelBookingAction(
  businessId: string,
  bookingId: string,
  reason?: string,
): Promise<Result> {
  const g = await gate(businessId);
  if (g.error || !g.actor) return { error: g.error };
  const res = await cancelBooking(businessId, bookingId, g.actor, reason?.slice(0, 200) ?? null);
  if (!res.error) await revalidateRentals(businessId);
  return res;
}

/* ── Blocks (§10) ──────────────────────────────────────────────────────────── */

export async function blockUnitAction(
  businessId: string,
  input: { unitId: string; checkIn: string; checkOut?: string | null; reason?: string },
): Promise<Result> {
  const g = await gate(businessId);
  if (g.error || !g.actor) return { error: g.error };
  const res = await blockUnit(
    { businessId, unitId: input.unitId, checkIn: input.checkIn,
      checkOut: input.checkOut ?? null, reason: input.reason ?? null },
    g.actor,
  );
  if (!res.error) await revalidateRentals(businessId);
  return res;
}

/* ── Unit types ────────────────────────────────────────────────────────────── */

export async function saveUnitTypeAction(
  businessId: string,
  input: { id?: string; name: string; description?: string; sort?: number },
): Promise<{ error?: string }> {
  const g = await gate(businessId);
  if (g.error) return { error: g.error };
  if (!input.name?.trim()) return { error: "נא להזין שם לסוג היחידה" };
  const res = await saveUnitType(businessId, input);
  if (!res.error) await revalidateRentals(businessId);
  return res;
}

export async function deleteUnitTypeAction(
  businessId: string,
  id: string,
): Promise<{ error?: string }> {
  const g = await gate(businessId);
  if (g.error) return { error: g.error };
  await deleteUnitType(businessId, id);
  await revalidateRentals(businessId);
  return {};
}

/* ── Search (§23) ──────────────────────────────────────────────────────────── */

export async function searchBookingsAction(
  businessIds: string[],
  query: string,
): Promise<{ error?: string; bookings?: PmsBooking[] }> {
  await requireUser();
  // Every id is gated individually — a caller cannot widen the search by
  // adding businesses they don't own, and RLS would drop them anyway.
  const allowed: string[] = [];
  for (const id of businessIds.slice(0, 20)) {
    if (await getBusiness(id)) allowed.push(id);
  }
  if (allowed.length === 0) return { bookings: [] };
  return { bookings: await searchBookings(allowed, query) };
}
