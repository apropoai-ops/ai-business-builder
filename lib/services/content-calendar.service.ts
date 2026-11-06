import { createClient } from "@/lib/supabase/server";
import type { CalendarEntry } from "@/types/database";

export async function getCalendarEntries(
  businessId: string,
): Promise<CalendarEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_entries")
    .select("*")
    .eq("business_id", businessId)
    .order("scheduled_for", { ascending: true });

  if (error) throw new Error(`Failed to load calendar entries: ${error.message}`);
  return data ?? [];
}

export async function insertCalendarEntries(
  businessId: string,
  entries: Array<{
    scheduled_for: string;
    platform: string;
    content_type: string;
    title: string;
    idea: string | null;
  }>,
): Promise<void> {
  const supabase = await createClient();
  const rows = entries.map((e) => ({ ...e, business_id: businessId }));
  const { error } = await supabase.from("calendar_entries").insert(rows);
  if (error) throw new Error(`Failed to insert calendar entries: ${error.message}`);
}

export async function setCalendarEntryStatus(
  id: string,
  status: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("calendar_entries")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(`Failed to update calendar entry: ${error.message}`);
}

export async function deleteCalendarEntry(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("calendar_entries").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete calendar entry: ${error.message}`);
}

export async function clearCalendar(businessId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("calendar_entries")
    .delete()
    .eq("business_id", businessId);
  if (error) throw new Error(`Failed to clear calendar: ${error.message}`);
}
