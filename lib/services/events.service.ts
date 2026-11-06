import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { EventItem } from "@/types/database";

// ── Owner (RLS) ─────────────────────────────────────────────────────────────

/** All events for the owner's dashboard, soonest first (nulls last). */
export async function listEvents(businessId: string): Promise<EventItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("business_id", businessId)
    .order("starts_at", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createEvent(
  businessId: string,
  fields: {
    title: string;
    description: string | null;
    starts_at: string | null;
    location: string | null;
    capacity: number | null;
    image_url: string | null;
  },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .insert({ business_id: businessId, ...fields });
  if (error) return { error: error.message };
  return {};
}

export async function deleteEvent(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setEventActive(id: string, active: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("events").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Public (service role) ──────────────────────────────────────────────────

/**
 * Active, upcoming events for the public site (service role). Only events that
 * are active and whose start time is in the future, soonest first.
 */
export async function listPublicEvents(businessId: string): Promise<EventItem[]> {
  const s = createServiceRoleClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await s
    .from("events")
    .select("*")
    .eq("business_id", businessId)
    .eq("active", true)
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
