import { createClient } from "@/lib/supabase/server";
import type { BookingService, Json } from "@/types/database";

/**
 * Owner-side CRUD for real bookable services (name + duration + price).
 * Replaces the legacy `booking_settings.services` JSON name list. RLS
 * (is_business_owner) scopes every read/write to the caller's own business —
 * no explicit ownership check needed here, matching lib/services/booking.service.ts.
 */

export const ALLOWED_DURATIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180] as const;

export async function listBookingServices(businessId: string): Promise<BookingService[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_services")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createBookingService(
  businessId: string,
  fields: { name: string; description?: string | null; duration_minutes: number; price: number | null; active?: boolean; sort?: number },
): Promise<BookingService> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_services")
    .insert({ business_id: businessId, ...fields })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateBookingService(
  id: string,
  fields: { name?: string; description?: string | null; duration_minutes?: number; price?: number | null; active?: boolean; sort?: number },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("booking_services").update(fields).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteBookingService(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("booking_services").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * One-click migration: copies the legacy `booking_settings.services` JSON
 * name list into real booking_services rows (duration = current slot_minutes,
 * price null), then clears the legacy JSON so the import button disappears.
 * No-op (returns 0) if there's nothing to import.
 */
export async function importLegacyServices(businessId: string): Promise<number> {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("booking_settings")
    .select("slot_minutes,services")
    .eq("business_id", businessId)
    .maybeSingle();
  const names = ((settings?.services as string[] | null) ?? []).filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  );
  if (names.length === 0) return 0;

  const duration = settings?.slot_minutes ?? 30;
  const rows = names.slice(0, 40).map((name, i) => ({
    business_id: businessId,
    name: name.trim().slice(0, 80),
    duration_minutes: duration,
    price: null,
    active: true,
    sort: i,
  }));
  const { error: insertError } = await supabase.from("booking_services").insert(rows);
  if (insertError) throw new Error(insertError.message);

  const { error: clearError } = await supabase
    .from("booking_settings")
    .update({ services: [] as unknown as Json })
    .eq("business_id", businessId);
  if (clearError) throw new Error(clearError.message);

  return rows.length;
}
