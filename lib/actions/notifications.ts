"use server";

import { requireUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import { getCostCapStatus, COST_ALERT_THRESHOLD } from "@/lib/quota";
import {
  getNotifications,
  type BusinessNotification,
} from "@/lib/services/notifications.service";

/**
 * Returns the current notification counts for a business (RLS-scoped to the
 * owner). Used by the client watcher to poll for new activity and pop a toast.
 */
export async function getNotificationsAction(
  businessId: string,
): Promise<BusinessNotification[]> {
  await requireUser();
  // RLS read proves ownership before returning anything.
  if (!(await getBusiness(businessId))) return [];

  const items = await getNotifications(businessId);

  // Cost-cap alert: warn the owner once a business crosses 80% of its monthly
  // AI spend ceiling, and again (distinct label) once it's fully blocked.
  const { used, cap, pct } = await getCostCapStatus(businessId);
  if (Number.isFinite(cap) && cap > 0 && pct >= COST_ALERT_THRESHOLD) {
    const blocked = pct >= 1;
    items.push({
      key: "ai_cost",
      count: 1,
      label: blocked
        ? `הגעתם לתקרת עלות ה-AI החודשית ($${cap}) — יצירות חדשות חסומות עד תחילת החודש`
        : `ניצול ${Math.round(pct * 100)}% מתקרת עלות ה-AI החודשית ($${used.toFixed(1)} מתוך $${cap})`,
      href: `/settings`,
    });
  }

  return items;
}
