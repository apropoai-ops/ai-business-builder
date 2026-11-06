import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { TeamMember } from "@/types/database";

// ── Owner (RLS) ─────────────────────────────────────────────────────────────

export async function listTeam(businessId: string): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createTeamMember(
  businessId: string,
  fields: {
    name: string;
    role: string | null;
    photo_url: string | null;
    bio: string | null;
  },
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("team_members")
    .insert({ business_id: businessId, ...fields });
  if (error) return { error: error.message };
  return {};
}

export async function deleteTeamMember(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("team_members").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Public (service role) ───────────────────────────────────────────────────

export async function listPublicTeam(businessId: string): Promise<TeamMember[]> {
  const s = createServiceRoleClient();
  const { data } = await s
    .from("team_members")
    .select("*")
    .eq("business_id", businessId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  return data ?? [];
}
