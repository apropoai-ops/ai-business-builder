"use server";

import { requireUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import { searchDashboard, type DashboardSearchResults } from "@/lib/services/dashboard-search.service";

/** "use server" entry for the dashboard-wide command palette (Ctrl+K) — see components/business/dashboard-search.tsx. */
export async function searchDashboardAction(
  businessId: string,
  query: string,
): Promise<DashboardSearchResults & { error?: string }> {
  await requireUser();
  const empty: DashboardSearchResults = { groups: [] };
  try {
    if (!(await getBusiness(businessId))) return { ...empty, error: "העסק לא נמצא" };
    return await searchDashboard(businessId, query);
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : "שגיאה" };
  }
}
