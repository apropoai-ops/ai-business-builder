import { createClient } from "@/lib/supabase/server";
import { getBusiness } from "@/lib/services/business.service";
import { generateHrRole } from "@/lib/ai/agents/hr";
import type { HrRole, Json } from "@/types/database";

export async function listHrRoles(businessId: string): Promise<HrRole[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hr_roles")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Generates a full hiring package for a role and stores it. */
export async function createHrRole(
  businessId: string,
  role: string,
  details?: string,
): Promise<HrRole> {
  const business = await getBusiness(businessId);
  if (!business) throw new Error("העסק לא נמצא");

  const content = await generateHrRole(business, role, details);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hr_roles")
    .insert({
      business_id: businessId,
      title: role.trim().slice(0, 120),
      content: content as unknown as Json,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to store HR role");
  return data;
}

export async function deleteHrRole(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("hr_roles").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
