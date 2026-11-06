import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { DownloadItem } from "@/types/database";

// ── Owner (RLS) ─────────────────────────────────────────────────────────────

export async function listDownloads(businessId: string): Promise<DownloadItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("downloads")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createDownload(
  businessId: string,
  fields: {
    title: string;
    description: string | null;
    file_url: string;
    price: number | null;
    image_url: string | null;
  },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("downloads").insert({ business_id: businessId, ...fields });
  if (error) return { error: error.message };
  return {};
}

export async function deleteDownload(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("downloads").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Public (service role) ───────────────────────────────────────────────────

/** Resources for a business's public site, ordered for display. */
export async function listPublicDownloads(businessId: string): Promise<DownloadItem[]> {
  const s = createServiceRoleClient();
  const { data, error } = await s
    .from("downloads")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
