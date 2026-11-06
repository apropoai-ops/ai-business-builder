import { createClient } from "@/lib/supabase/server";
import type { BookingStaff, Json } from "@/types/database";
import type { WeeklyHours } from "@/lib/booking-shared";
import { normalizePhoneForWhatsapp } from "@/lib/phone";

/** Normalizes an optional staff phone to E.164 ("+972...") for storage. */
function normalizeStaffPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = normalizePhoneForWhatsapp(trimmed);
  return digits ? `+${digits}` : trimmed;
}

/**
 * Owner-side CRUD for staff members (providers/resources) and their
 * service assignments. RLS (is_business_owner) scopes every read/write to
 * the caller's own business, matching lib/services/booking-services.service.ts.
 *
 * hours=null on a staff row means "inherit the business's weekly hours".
 * Zero rows in booking_staff_services for a staff member means "offers all
 * services" — an explicit row set narrows it to those services only.
 */

export async function listBookingStaff(businessId: string): Promise<BookingStaff[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_staff")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createBookingStaff(
  businessId: string,
  fields: {
    name: string;
    roleTitle?: string | null;
    color?: string | null;
    email?: string | null;
    phone?: string | null;
  },
): Promise<BookingStaff> {
  const supabase = await createClient();

  const { data: maxRow } = await supabase
    .from("booking_staff")
    .select("sort")
    .eq("business_id", businessId)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = (maxRow?.sort ?? -1) + 1;

  const { data, error } = await supabase
    .from("booking_staff")
    .insert({
      business_id: businessId,
      name: fields.name,
      role_title: fields.roleTitle ?? null,
      color: fields.color ?? null,
      email: fields.email?.trim() || null,
      phone: normalizeStaffPhone(fields.phone),
      sort: nextSort,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateBookingStaff(
  businessId: string,
  staffId: string,
  fields: {
    name?: string;
    roleTitle?: string | null;
    color?: string | null;
    active?: boolean;
    sort?: number;
    hours?: WeeklyHours | null;
    email?: string | null;
    phone?: string | null;
  },
): Promise<void> {
  const supabase = await createClient();
  const patch: {
    name?: string;
    role_title?: string | null;
    color?: string | null;
    active?: boolean;
    sort?: number;
    hours?: Json | null;
    email?: string | null;
    phone?: string | null;
  } = {};
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.roleTitle !== undefined) patch.role_title = fields.roleTitle;
  if (fields.color !== undefined) patch.color = fields.color;
  if (fields.active !== undefined) patch.active = fields.active;
  if (fields.sort !== undefined) patch.sort = fields.sort;
  if (fields.hours !== undefined) patch.hours = fields.hours as unknown as Json;
  if (fields.email !== undefined) patch.email = fields.email?.trim() || null;
  if (fields.phone !== undefined) patch.phone = normalizeStaffPhone(fields.phone);

  const { error } = await supabase
    .from("booking_staff")
    .update(patch)
    .eq("id", staffId)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);
}

export async function deleteBookingStaff(businessId: string, staffId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("booking_staff")
    .delete()
    .eq("id", staffId)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);
}

/** staffId → serviceIds it's explicitly assigned to (missing key = offers all services). */
export async function listStaffServices(businessId: string): Promise<Record<string, string[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_staff_services")
    .select("staff_id,service_id")
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);

  const byStaff: Record<string, string[]> = {};
  for (const row of data ?? []) {
    (byStaff[row.staff_id] ??= []).push(row.service_id);
  }
  return byStaff;
}

/** Replaces a staff member's service assignments. Empty array = offers all services. */
export async function setStaffServices(
  businessId: string,
  staffId: string,
  serviceIds: string[],
): Promise<void> {
  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("booking_staff_services")
    .delete()
    .eq("business_id", businessId)
    .eq("staff_id", staffId);
  if (deleteError) throw new Error(deleteError.message);

  if (serviceIds.length === 0) return;

  const rows = serviceIds.map((serviceId) => ({
    business_id: businessId,
    staff_id: staffId,
    service_id: serviceId,
  }));
  const { error: insertError } = await supabase.from("booking_staff_services").insert(rows);
  if (insertError) throw new Error(insertError.message);
}
