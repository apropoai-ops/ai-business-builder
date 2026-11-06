import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { MenuItem } from "@/types/database";

// ── Owner (RLS) ─────────────────────────────────────────────────────────────

/** All menu items for the owner's dashboard, ordered for display. */
export async function listMenu(businessId: string): Promise<MenuItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createMenuItem(
  businessId: string,
  fields: {
    section: string | null;
    name: string;
    description: string | null;
    price: number | null;
    image_url: string | null;
  },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_items")
    .insert({ business_id: businessId, ...fields });
  if (error) return { error: error.message };
  return {};
}

export async function deleteMenuItem(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("menu_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Public (service role) ───────────────────────────────────────────────────

/** Public menu for the storefront, ordered by sort. */
export async function listPublicMenu(businessId: string): Promise<MenuItem[]> {
  const s = createServiceRoleClient();
  const { data, error } = await s
    .from("menu_items")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
