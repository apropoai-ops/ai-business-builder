import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { Course } from "@/types/database";

// ── Owner (RLS) ─────────────────────────────────────────────────────────────

/** All courses for the owner's dashboard, ordered for display. */
export async function listCourses(businessId: string): Promise<Course[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createCourse(
  businessId: string,
  fields: {
    title: string;
    description: string | null;
    price: number | null;
    level: string | null;
    duration: string | null;
    image_url: string | null;
  },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("courses")
    .insert({ business_id: businessId, ...fields });
  if (error) return { error: error.message };
  return {};
}

export async function deleteCourse(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setCourseActive(
  id: string,
  active: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("courses")
    .update({ active })
    .eq("id", id);
  if (error) return { error: error.message };
  return {};
}

// ── Public (service role) ───────────────────────────────────────────────────

/** Public, active courses for the storefront, ordered by sort. */
export async function listPublicCourses(businessId: string): Promise<Course[]> {
  const s = createServiceRoleClient();
  const { data, error } = await s
    .from("courses")
    .select("*")
    .eq("business_id", businessId)
    .eq("active", true)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
