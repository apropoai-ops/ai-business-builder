import { createClient } from "@/lib/supabase/server";
import type { ContentItem } from "@/types/database";

export async function getContentItems(businessId: string): Promise<ContentItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_items")
    .select("*")
    .eq("business_id", businessId)
    .order("generated_at", { ascending: false });

  if (error) throw new Error(`Failed to load content items: ${error.message}`);
  return data ?? [];
}

export async function insertContentItems(
  businessId: string,
  items: Array<{
    type: string;
    title: string | null;
    content: string;
    hashtags: string[];
    cta?: string | null;
    topic: string;
  }>,
): Promise<void> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const rows = items.map((item) => ({
    business_id: businessId,
    type: item.type,
    title: item.title ?? null,
    content: item.content,
    hashtags: item.hashtags,
    cta: item.cta ?? null,
    topic: item.topic,
    generated_at: now,
  }));

  const { error } = await supabase.from("content_items").insert(rows);
  if (error) throw new Error(`Failed to insert content items: ${error.message}`);
}

export async function deleteContentItem(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("content_items").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete content item: ${error.message}`);
}
