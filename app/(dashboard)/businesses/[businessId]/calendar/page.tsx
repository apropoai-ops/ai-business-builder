import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";

import { getBusiness } from "@/lib/services/business.service";
import { getCalendarEntries } from "@/lib/services/content-calendar.service";
import { getLatestJob } from "@/lib/services/job.service";
import { getPlanForBusiness } from "@/lib/quota";
import { planAllows } from "@/lib/entitlements";
import { CalendarView } from "@/components/business/calendar-view";
import { UpgradeGate } from "@/components/billing/upgrade-gate";
import { assertNavAllowed } from "@/lib/dashboard-guard";

export const metadata = { title: "לוח תוכן" };

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();
  assertNavAllowed(business.site_mode, "calendar");

  const plan = await getPlanForBusiness(businessId);
  if (!planAllows(plan, "content_calendar")) {
    return (
      <div className="flex flex-col gap-6">
        <UpgradeGate feature="content_calendar" />
      </div>
    );
  }

  const [entries, latestJob] = await Promise.all([
    getCalendarEntries(businessId),
    getLatestJob(businessId, "content_calendar"),
  ]);

  const isGenerating = latestJob?.status === "running";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarDays className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">לוח תוכן</h1>
          <p className="text-sm text-muted-foreground">
            תוכנית פרסום מתוזמנת לשבוע, חודש או רבעון — מסונכרנת לפלטפורמות שלך
          </p>
        </div>
      </div>

      <CalendarView
        businessId={businessId}
        entries={entries}
        isGenerating={isGenerating}
      />
    </div>
  );
}
