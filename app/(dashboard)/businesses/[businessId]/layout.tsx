import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { getBusiness, listBusinesses } from "@/lib/services/business.service";
import { getNotifications } from "@/lib/services/notifications.service";
import { businessFitsRentals } from "@/lib/business-type";
import { getPlanForBusiness, getActiveAddonsForBusiness } from "@/lib/quota";
import { planAllows } from "@/lib/entitlements";
import { BusinessNav } from "@/components/shared/business-nav";
import { BusinessStatusBadge } from "@/components/shared/business-status-badge";
import { BusinessSwitcher } from "@/components/business/business-switcher";
import { NotificationsBell } from "@/components/business/notifications-bell";
import { NotificationsWatcher } from "@/components/business/notifications-watcher";
import { DashboardSearch } from "@/components/business/dashboard-search";

export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const [business, businesses, notifications, plan, addons] = await Promise.all([
    getBusiness(businessId),
    listBusinesses(),
    getNotifications(businessId),
    getPlanForBusiness(businessId),
    getActiveAddonsForBusiness(businessId),
  ]);
  if (!business) {
    notFound();
  }

  const hasRentals = planAllows(plan, "rentals", addons);
  // sellsNights forces the חנות screen open outside store mode for a
  // brochure-mode צימר, regardless of the `rentals` entitlement (they still
  // need to reach the screen to see the upsell) — now driven by the AI
  // classification (migration 0092) instead of the old isHospitality()
  // keyword scan.
  const sellsNights = businessFitsRentals(business);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <nav className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/businesses" className="hover:text-foreground">
          העסקים שלי
        </Link>
        <ChevronRight className="size-4 rotate-180" />
        <span className="text-foreground">{business.name ?? "עסק"}</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <BusinessSwitcher
          businesses={businesses.map((b) => ({
            id: b.id,
            name: b.name,
            status: b.status,
          }))}
          currentId={businessId}
          currentName={business.name ?? "עסק ללא שם"}
        />
        <BusinessStatusBadge status={business.status} />
        <div className="ms-auto flex items-center gap-2">
          <DashboardSearch businessId={businessId} />
          <NotificationsBell notifications={notifications} />
        </div>
      </div>
      <NotificationsWatcher businessId={businessId} initial={notifications} />

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        {/* Grouped nav is taller than the old flat list — let it scroll inside
            the sticky column instead of running past the bottom of the screen. */}
        <aside className="md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:self-start md:overflow-y-auto md:pe-1">
          <BusinessNav
            businessId={businessId}
            siteMode={business.site_mode}
            sellsNights={sellsNights}
            hasRentals={hasRentals}
            hiddenNavKeys={business.hidden_nav_keys}
          />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
