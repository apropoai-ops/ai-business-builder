import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { BusinessEvent, TablesInsert, TablesUpdate } from "@/types/database";

/** Wide range for the weekly calendar view: last week → +8 weeks (mirrors listBookingsRange). */
export async function listBusinessEventsRange(businessId: string): Promise<BusinessEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_events")
    .select("*")
    .eq("business_id", businessId)
    .gte("starts_at", new Date(Date.now() - 7 * 86400_000).toISOString())
    .lte("starts_at", new Date(Date.now() + 56 * 86400_000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(300);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Events whose start falls within a calendar month (±2 day buffer for grid edges). */
export async function listBusinessEventsForMonth(
  businessId: string,
  year: number,
  month: number, // 1-12
): Promise<BusinessEvent[]> {
  const supabase = await createClient();
  const start = new Date(Date.UTC(year, month - 1, 1) - 2 * 86400_000);
  const end = new Date(Date.UTC(year, month - 1, 1) + 33 * 86400_000);
  const { data, error } = await supabase
    .from("business_events")
    .select("*")
    .eq("business_id", businessId)
    .gte("starts_at", start.toISOString())
    .lte("starts_at", end.toISOString())
    .order("starts_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createBusinessEvent(
  businessId: string,
  input: Omit<TablesInsert<"business_events">, "business_id">,
): Promise<BusinessEvent> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_events")
    .insert({ ...input, business_id: businessId })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "יצירת האירוע נכשלה");
  return data;
}

export async function updateBusinessEvent(
  businessId: string,
  id: string,
  fields: TablesUpdate<"business_events">,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("business_events")
    .update(fields)
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);
}

export async function deleteBusinessEvent(businessId: string, id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("business_events")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);
}

export type FeedEvent = {
  id: string;
  title: string;
  staff_id: string | null;
  starts_at: string;
  ends_at: string;
  notes: string | null;
};

/**
 * Upcoming events for the public live ICS feed (service role). Caller must
 * have already verified the feed token (see booking.service.verifyIcsFeedToken).
 */
export async function getFeedEvents(businessId: string, staffId?: string | null): Promise<FeedEvent[]> {
  const s = createServiceRoleClient();
  let query = s
    .from("business_events")
    .select("id,title,staff_id,starts_at,ends_at,notes")
    .eq("business_id", businessId)
    .gte("starts_at", new Date(Date.now() - 24 * 3600_000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(300);
  if (staffId) query = query.eq("staff_id", staffId);
  const { data } = await query;
  return data ?? [];
}
