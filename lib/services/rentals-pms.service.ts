import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  RENTAL_STATUS_META,
  addDays,
  isDateStr,
  nightsBetween,
  rentalTotal,
  todayIL,
  type OccupyingRow,
} from "@/lib/rentals";
import type {
  Json,
  RentalBooking,
  RentalBookingStatus,
  RentalUnit,
  RentalUnitType,
} from "@/types/database";

/**
 * The property-management read/write layer for "לוח לילות".
 *
 * Deliberately a NEW module beside `rentals.service.ts` rather than a rewrite
 * of it: that file still serves the public storefront (`listPublicUnits`,
 * `createPendingRentalBooking`, `finalizeRentalBooking`) and the חנות card, all
 * of which work and are in production. Nothing here replaces them.
 *
 * Two rules hold everywhere below:
 *   1. Owner reads/writes go through the RLS client, so a caller can only ever
 *      touch a business they own — the query never has to be trusted.
 *   2. Availability is proposed here and DECIDED by the database. Every write
 *      that moves dates catches 23P01 (the rental_bookings_no_overlap exclusion
 *      constraint) and reports it as "those dates are taken". The pre-check
 *      exists for a good error message, not for correctness.
 */

/** Postgres exclusion-constraint violation — someone else took the dates. */
const OVERLAP = "23P01";
const OVERLAP_MSG = "התאריכים האלה כבר תפוסים ביחידה הזו";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type PmsUnit = RentalUnit & { type_name: string | null };

export type PmsBooking = RentalBooking & {
  unit_name: string;
  unit_code: string | null;
};

export type PmsSnapshot = {
  units: PmsUnit[];
  unitTypes: RentalUnitType[];
  /** Every stay and block touching [from, to] — what the board is drawn from. */
  bookings: PmsBooking[];
  from: string;
  to: string;
};

export type BusinessOption = { id: string; name: string; units: number };

/* ── Reads ─────────────────────────────────────────────────────────────────── */

export async function listUnitTypes(businessId: string): Promise<RentalUnitType[]> {
  const s = await createClient();
  const { data } = await s
    .from("rental_unit_types")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  return data ?? [];
}

async function unitsWithTypes(businessIds: string[]): Promise<PmsUnit[]> {
  if (businessIds.length === 0) return [];
  const s = await createClient();
  const [{ data: units }, { data: types }] = await Promise.all([
    s.from("rental_units").select("*").in("business_id", businessIds)
      .order("sort", { ascending: true }).order("created_at", { ascending: true }),
    s.from("rental_unit_types").select("id, name").in("business_id", businessIds),
  ]);
  const typeName = new Map((types ?? []).map((t) => [t.id, t.name]));
  return (units ?? []).map((u) => ({
    ...u,
    type_name: u.unit_type_id ? (typeName.get(u.unit_type_id) ?? null) : null,
  }));
}

/**
 * Everything the calendar needs for a date window, in three queries.
 *
 * The window is widened by one day on each side before it hits the database:
 * a stay that checks in the day BEFORE `from` still occupies the first visible
 * night, and without the padding it would silently vanish from the left edge of
 * every month view.
 */
export async function loadBoard(
  businessIds: string[],
  from: string,
  to: string,
): Promise<PmsSnapshot> {
  const empty: PmsSnapshot = { units: [], unitTypes: [], bookings: [], from, to };
  if (businessIds.length === 0 || !isDateStr(from) || !isDateStr(to)) return empty;

  const units = await unitsWithTypes(businessIds);
  if (units.length === 0) {
    return { ...empty, unitTypes: await listUnitTypes(businessIds[0]) };
  }

  const s = await createClient();
  const [{ data: bookings }, { data: types }] = await Promise.all([
    s
      .from("rental_bookings")
      .select("*")
      .in("business_id", businessIds)
      // Half-open overlap test, same shape as the exclusion constraint: a row
      // is visible when it starts before the window ends and ends after it starts.
      .lt("check_in", addDays(to, 1))
      .gt("check_out", from)
      .order("check_in", { ascending: true }),
    s.from("rental_unit_types").select("*").in("business_id", businessIds)
      .order("sort", { ascending: true }),
  ]);

  const meta = new Map(units.map((u) => [u.id, u]));
  return {
    units,
    unitTypes: types ?? [],
    bookings: (bookings ?? []).map((b) => ({
      ...b,
      unit_name: meta.get(b.unit_id)?.name ?? "יחידה",
      unit_code: meta.get(b.unit_id)?.code ?? null,
    })),
    from,
    to,
  };
}

/** The occupying rows for a unit, as the pure engine wants them. */
export async function occupancyFor(
  businessIds: string[],
  from: string,
  to: string,
): Promise<OccupyingRow[]> {
  const { bookings } = await loadBoard(businessIds, from, to);
  return bookings.map((b) => ({
    unit_id: b.unit_id,
    check_in: b.check_in,
    check_out: b.check_out,
    status: b.status,
    kind: b.kind,
  }));
}

/**
 * The businesses this user may manage nights for, with a unit count.
 *
 * RLS decides membership — `rental_units` is only selectable through
 * `is_business_owner()`, so a business the caller has no claim on simply
 * returns no rows and never reaches the picker.
 */
export async function listRentalBusinesses(): Promise<BusinessOption[]> {
  const s = await createClient();
  const { data: units } = await s.from("rental_units").select("business_id");
  const counts = new Map<string, number>();
  for (const u of units ?? []) counts.set(u.business_id, (counts.get(u.business_id) ?? 0) + 1);

  const { data: businesses } = await s.from("businesses").select("id, name");
  return (businesses ?? [])
    .map((b) => ({ id: b.id, name: b.name ?? "עסק", units: counts.get(b.id) ?? 0 }))
    .sort((a, b) => b.units - a.units || a.name.localeCompare(b.name, "he"));
}

/** Free-text search over guest name / phone / email / booking number (§23). */
export async function searchBookings(
  businessIds: string[],
  query: string,
  limit = 50,
): Promise<PmsBooking[]> {
  if (businessIds.length === 0) return [];
  const q = query.trim();
  const s = await createClient();

  let req = s.from("rental_bookings").select("*").in("business_id", businessIds).eq("kind", "booking");
  if (q) {
    const digits = q.replace(/\D/g, "");
    const like = `%${q.replace(/[%,]/g, "")}%`;
    const clauses = [`guest_name.ilike.${like}`, `guest_phone.ilike.${like}`, `guest_email.ilike.${like}`];
    // A bare number is almost always the booking number being read off a phone.
    if (digits && digits === q) clauses.push(`booking_no.eq.${digits}`);
    req = req.or(clauses.join(","));
  }

  const { data } = await req.order("check_in", { ascending: false }).limit(limit);
  const units = await unitsWithTypes(businessIds);
  const meta = new Map(units.map((u) => [u.id, u]));
  return (data ?? []).map((b) => ({
    ...b,
    unit_name: meta.get(b.unit_id)?.name ?? "יחידה",
    unit_code: meta.get(b.unit_id)?.code ?? null,
  }));
}

export async function getBookingEvents(bookingId: string) {
  const s = await createClient();
  const { data } = await s
    .from("rental_booking_events")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

/* ── Dashboard (§13) ───────────────────────────────────────────────────────── */

export type PmsStats = {
  businesses: number;
  units: number;
  arrivalsToday: number;
  departuresToday: number;
  staying: number;
  freeTonight: number;
  pending: number;
  revenue30d: number;
  occupancy30d: number;
};

/**
 * The numbers on the dashboard, computed from tonight's real occupancy rather
 * than from a stored counter — a counter would drift the first time a booking
 * was cancelled outside the one code path that maintained it.
 */
export async function loadStats(businessIds: string[]): Promise<PmsStats> {
  const today = todayIL();
  const zero: PmsStats = {
    businesses: businessIds.length, units: 0, arrivalsToday: 0, departuresToday: 0,
    staying: 0, freeTonight: 0, pending: 0, revenue30d: 0, occupancy30d: 0,
  };
  if (businessIds.length === 0) return zero;

  const windowFrom = addDays(today, -29);
  const [{ units, bookings }, board] = await Promise.all([
    loadBoard(businessIds, today, today),
    loadBoard(businessIds, windowFrom, today),
  ]);

  const active = units.filter((u) => u.active);
  const live = bookings.filter((b) => b.status !== "cancelled" && b.kind === "booking");

  const arrivalsToday = live.filter((b) => b.check_in === today).length;
  const departuresToday = bookings.filter(
    (b) => b.check_out === today && b.status !== "cancelled" && b.kind === "booking",
  ).length;
  // Tonight is occupied when the stay covers it: checked in on/before today and
  // checks out after today (check-out day is already free).
  const occupiedUnits = new Set(
    bookings
      .filter((b) => b.status !== "cancelled" && b.check_in <= today && b.check_out > today)
      .map((b) => b.unit_id),
  );

  const paid = board.bookings.filter(
    (b) => b.kind === "booking" && b.status !== "cancelled" && b.check_in >= windowFrom,
  );
  const revenue30d = Math.round(paid.reduce((sum, b) => sum + Number(b.total || 0), 0));
  const soldNights = paid.reduce((sum, b) => sum + Math.max(0, Number(b.nights || 0)), 0);
  const capacity = active.length * 30;

  return {
    businesses: businessIds.length,
    units: active.length,
    arrivalsToday,
    departuresToday,
    staying: occupiedUnits.size,
    freeTonight: Math.max(0, active.length - occupiedUnits.size),
    pending: live.filter((b) => b.status === "pending").length,
    revenue30d,
    occupancy30d: capacity > 0 ? Math.round((soldNights / capacity) * 100) : 0,
  };
}

/* ── Audit (§26) ───────────────────────────────────────────────────────────── */

/**
 * Appends to the history. Service-role because `rental_booking_events` revokes
 * INSERT from every client role — history the people who make it can rewrite
 * is not history.
 *
 * Never throws: a booking must not fail because its audit line did.
 */
export async function logBookingEvent(input: {
  businessId: string;
  bookingId: string | null;
  actorUserId?: string | null;
  actorName?: string | null;
  action: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await createServiceRoleClient().from("rental_booking_events").insert({
      business_id: input.businessId,
      booking_id: input.bookingId,
      actor_user_id: input.actorUserId ?? null,
      actor_name: input.actorName ?? null,
      action: input.action,
      details: (input.details ?? {}) as Json,
    });
  } catch {
    // history is best-effort
  }
}

/* ── Writes ────────────────────────────────────────────────────────────────── */

export type ManualBookingInput = {
  businessId: string;
  unitId: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string | null;
  guests: number;
  pricePerNight?: number | null;
  total?: number | null;
  notes?: string | null;
  status?: Extract<RentalBookingStatus, "pending" | "confirmed">;
};

type WriteResult = { error?: string; bookingId?: string };

/** Maps a Postgres error onto a sentence the owner can act on. */
function writeError(error: { code?: string; message?: string } | null): string {
  if (error?.code === OVERLAP) return OVERLAP_MSG;
  if (error?.code === "23514") return "פרטי ההזמנה אינם תקינים";
  return error?.message ?? "הפעולה נכשלה";
}

/**
 * Validates the shared shape of any date-moving write. Returns the resolved
 * unit (proving it belongs to this business) or a Hebrew error.
 */
async function resolveUnit(
  businessId: string,
  unitId: string,
  checkIn: string,
  checkOut: string,
): Promise<{ unit?: RentalUnit; error?: string; nights?: number }> {
  if (!isDateStr(checkIn) || !isDateStr(checkOut)) return { error: "תאריכים לא תקינים" };
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) return { error: "תאריך היציאה חייב להיות אחרי תאריך הכניסה" };

  const s = await createClient();
  const { data: unit } = await s
    .from("rental_units").select("*").eq("id", unitId).eq("business_id", businessId).maybeSingle();
  if (!unit) return { error: "היחידה לא נמצאה" };
  return { unit, nights };
}

/**
 * Owner-created booking (§8, §22). Unlike the public flow this does NOT go
 * through payment — the owner is recording a stay they already agreed to, by
 * phone or in person, so it lands confirmed unless told otherwise.
 */
export async function createManualBooking(
  input: ManualBookingInput,
  actor: { id?: string | null; name?: string | null },
): Promise<WriteResult> {
  const { unit, error, nights } = await resolveUnit(
    input.businessId, input.unitId, input.checkIn, input.checkOut,
  );
  if (error || !unit || !nights) return { error };

  const guests = Math.max(1, Math.min(Number(input.guests) || 1, unit.max_guests));
  const rate = Number(
    input.pricePerNight != null && input.pricePerNight >= 0
      ? input.pricePerNight
      : unit.nightly_price,
  );
  const total = Number(
    input.total != null && input.total >= 0 ? input.total : rentalTotal(rate, nights),
  );

  const s = await createClient();
  const { data, error: dbError } = await s
    .from("rental_bookings")
    .insert({
      business_id: input.businessId,
      unit_id: input.unitId,
      kind: "booking",
      check_in: input.checkIn,
      check_out: input.checkOut,
      guest_name: input.guestName,
      guest_phone: input.guestPhone,
      guest_email: input.guestEmail || null,
      guests,
      nights,
      price_per_night: rate,
      total,
      status: input.status ?? "confirmed",
      payment_status: "pending",
      source: "manual",
      notes: input.notes || null,
    })
    .select("id")
    .single();

  if (dbError || !data) return { error: writeError(dbError) };

  await logBookingEvent({
    businessId: input.businessId,
    bookingId: data.id,
    actorUserId: actor.id,
    actorName: actor.name,
    action: "created",
    details: { check_in: input.checkIn, check_out: input.checkOut, unit: unit.name, total },
  });
  return { bookingId: data.id };
}

/**
 * Moves or re-prices an existing booking (§11).
 *
 * Any change to dates or unit is re-validated exactly like a new booking, and
 * the constraint still has the final word — so dragging a stay onto an
 * occupied night fails at the database, not after the UI has already redrawn.
 */
export async function updateBooking(
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
  actor: { id?: string | null; name?: string | null },
): Promise<WriteResult> {
  const s = await createClient();
  const { data: current } = await s
    .from("rental_bookings").select("*").eq("id", bookingId).eq("business_id", businessId).maybeSingle();
  if (!current) return { error: "ההזמנה לא נמצאה" };

  const unitId = patch.unitId ?? current.unit_id;
  const checkIn = patch.checkIn ?? current.check_in;
  const checkOut = patch.checkOut ?? current.check_out;
  const { unit, error, nights } = await resolveUnit(businessId, unitId, checkIn, checkOut);
  if (error || !unit || !nights) return { error };

  if (patch.status && patch.status !== current.status) {
    // A block may only ever be blocked or cancelled; the DB enforces it, but
    // saying so here turns a constraint violation into a readable sentence.
    const allowed: RentalBookingStatus[] =
      current.kind === "block"
        ? ["blocked", "cancelled"]
        : ["pending", "confirmed", "cancelled", "completed", "no_show"];
    if (!allowed.includes(patch.status)) return { error: "סטטוס לא חוקי לרשומה הזו" };
  }

  const guests = patch.guests != null
    ? Math.max(1, Math.min(Number(patch.guests) || 1, unit.max_guests))
    : current.guests;
  const rate = patch.pricePerNight != null && patch.pricePerNight >= 0
    ? Number(patch.pricePerNight)
    : Number(current.price_per_night || unit.nightly_price);
  const total = patch.total != null && patch.total >= 0
    ? Number(patch.total)
    // Re-price only when the length actually changed — otherwise an owner's
    // manual discount would be silently overwritten on every unrelated edit.
    : nights !== current.nights ? rentalTotal(rate, nights) : Number(current.total);

  const status = patch.status ?? current.status;
  const { error: dbError } = await s
    .from("rental_bookings")
    .update({
      unit_id: unitId,
      check_in: checkIn,
      check_out: checkOut,
      nights,
      guests,
      price_per_night: rate,
      total,
      status,
      ...(patch.guestName !== undefined ? { guest_name: patch.guestName } : {}),
      ...(patch.guestPhone !== undefined ? { guest_phone: patch.guestPhone } : {}),
      ...(patch.guestEmail !== undefined ? { guest_email: patch.guestEmail } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(status === "cancelled" && current.status !== "cancelled"
        ? { cancelled_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", bookingId)
    .eq("business_id", businessId);

  if (dbError) return { error: writeError(dbError) };

  const changes: Record<string, unknown> = {};
  if (checkIn !== current.check_in || checkOut !== current.check_out) {
    changes.dates = { from: `${current.check_in}→${current.check_out}`, to: `${checkIn}→${checkOut}` };
  }
  if (unitId !== current.unit_id) changes.unit = { to: unit.name };
  if (status !== current.status) changes.status = { from: current.status, to: status };
  if (total !== Number(current.total)) changes.total = { from: Number(current.total), to: total };

  await logBookingEvent({
    businessId,
    bookingId,
    actorUserId: actor.id,
    actorName: actor.name,
    action: status === "cancelled" && current.status !== "cancelled" ? "cancelled" : "updated",
    details: changes,
  });
  return { bookingId };
}

/**
 * Cancels rather than deletes (§12). The row stays for history and the nights
 * return to the pool the moment the status flips — that is the exclusion
 * constraint's `WHERE status <> 'cancelled'` doing the work, with no separate
 * "release the dates" step that could be forgotten.
 */
export async function cancelBooking(
  businessId: string,
  bookingId: string,
  actor: { id?: string | null; name?: string | null },
  reason?: string | null,
): Promise<WriteResult> {
  const s = await createClient();
  const { error } = await s
    .from("rental_bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", bookingId)
    .eq("business_id", businessId);
  if (error) return { error: writeError(error) };

  await logBookingEvent({
    businessId, bookingId, actorUserId: actor.id, actorName: actor.name,
    action: "cancelled", details: reason ? { reason } : {},
  });
  return { bookingId };
}

/**
 * Blocks a unit for maintenance (§10) — stored as a booking row with
 * kind='block', so the SAME exclusion constraint that stops double-booking
 * stops anyone booking over the block, in both directions.
 *
 * `checkOut` may be omitted for an open-ended hold; it becomes a one-year block
 * the owner releases by cancelling it. A truly unbounded range would need
 * `infinity`, which the date column accepts but every consumer that formats a
 * date would then have to special-case.
 */
export async function blockUnit(
  input: {
    businessId: string;
    unitId: string;
    checkIn: string;
    checkOut?: string | null;
    reason?: string | null;
  },
  actor: { id?: string | null; name?: string | null },
): Promise<WriteResult> {
  const checkOut = input.checkOut && isDateStr(input.checkOut)
    ? input.checkOut
    : addDays(input.checkIn, 365);
  const { unit, error, nights } = await resolveUnit(
    input.businessId, input.unitId, input.checkIn, checkOut,
  );
  if (error || !unit || !nights) return { error };

  const s = await createClient();
  const { data, error: dbError } = await s
    .from("rental_bookings")
    .insert({
      business_id: input.businessId,
      unit_id: input.unitId,
      kind: "block",
      status: "blocked",
      check_in: input.checkIn,
      check_out: checkOut,
      nights,
      guests: 1,
      price_per_night: 0,
      total: 0,
      source: "manual",
      block_reason: input.reason?.slice(0, 200) || null,
    })
    .select("id")
    .single();
  if (dbError || !data) return { error: writeError(dbError) };

  await logBookingEvent({
    businessId: input.businessId, bookingId: data.id,
    actorUserId: actor.id, actorName: actor.name,
    action: "blocked",
    details: { unit: unit.name, from: input.checkIn, to: checkOut, reason: input.reason ?? null },
  });
  return { bookingId: data.id };
}

/* ── Unit types ────────────────────────────────────────────────────────────── */

export async function saveUnitType(
  businessId: string,
  input: { id?: string; name: string; description?: string | null; sort?: number },
): Promise<{ error?: string }> {
  const s = await createClient();
  const fields = {
    name: input.name.trim().slice(0, 80),
    description: input.description?.trim().slice(0, 400) || null,
    sort: input.sort ?? 0,
  };
  const { error } = input.id
    ? await s.from("rental_unit_types").update(fields).eq("id", input.id).eq("business_id", businessId)
    : await s.from("rental_unit_types").insert({ business_id: businessId, ...fields });
  return error ? { error: error.message } : {};
}

export async function deleteUnitType(businessId: string, id: string): Promise<void> {
  const s = await createClient();
  // Units keep existing; the FK is ON DELETE SET NULL, so they just become
  // "untyped" rather than disappearing with their bookings.
  await s.from("rental_unit_types").delete().eq("id", id).eq("business_id", businessId);
}

/* ── Housekeeping ──────────────────────────────────────────────────────────── */

/**
 * Releases expired unpaid holds. A "request to book" occupies real nights, so
 * without this a handful of abandoned requests would quietly freeze a unit's
 * calendar. Cancelling (never deleting) keeps the trail and frees the dates in
 * the same statement.
 */
export async function expireStaleHolds(businessIds: string[]): Promise<number> {
  if (businessIds.length === 0) return 0;
  const s = createServiceRoleClient();
  const { data } = await s
    .from("rental_bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .in("business_id", businessIds)
    .eq("status", "pending")
    .eq("payment_status", "pending")
    .not("hold_expires_at", "is", null)
    .lt("hold_expires_at", new Date().toISOString())
    .select("id, business_id");

  for (const row of data ?? []) {
    await logBookingEvent({
      businessId: row.business_id, bookingId: row.id,
      actorName: "מערכת", action: "hold_expired",
    });
  }
  return (data ?? []).length;
}

export { RENTAL_STATUS_META };
