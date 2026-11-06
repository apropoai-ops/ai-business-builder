import { createClient } from "@/lib/supabase/server";
import type { SocialProfile, Json } from "@/types/database";

export async function getSocialProfiles(
  businessId: string,
): Promise<SocialProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("social_profiles")
    .select("*")
    .eq("business_id", businessId);

  if (error) throw new Error(`Failed to load social profiles: ${error.message}`);
  return data ?? [];
}

export async function upsertSocialProfile(
  businessId: string,
  profile: {
    platform: string;
    bio: string;
    content_pillars: Json;
    posting_frequency: string;
    best_times: Json;
    hashtag_sets: Json;
    sample_posts: Json;
    growth_tips: Json;
  },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("social_profiles")
    .upsert(
      {
        business_id: businessId,
        ...profile,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,platform" },
    );
  if (error) throw new Error(`Failed to upsert social profile: ${error.message}`);
}
