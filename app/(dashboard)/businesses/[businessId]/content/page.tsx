import { notFound } from "next/navigation";
import { PenLine } from "lucide-react";

import { getBusiness } from "@/lib/services/business.service";
import { getContentItems } from "@/lib/services/content.service";
import { getLatestJob } from "@/lib/services/job.service";
import { getPlanForBusiness } from "@/lib/quota";
import { planAllows } from "@/lib/entitlements";
import { ContentView } from "@/components/business/content-view";
import { UpgradeGate } from "@/components/billing/upgrade-gate";
import { assertNavAllowed } from "@/lib/dashboard-guard";

export const metadata = { title: "מנוע תוכן" };

export default async function ContentPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();
  assertNavAllowed(business.site_mode, "content");

  const plan = await getPlanForBusiness(businessId);
  if (!planAllows(plan, "content_engine")) {
    return (
      <div className="flex flex-col gap-6">
        <UpgradeGate feature="content_engine" />
      </div>
    );
  }

  const [items, latestJob] = await Promise.all([
    getContentItems(businessId),
    getLatestJob(businessId, "content"),
  ]);

  const isGenerating = latestJob?.status === "running";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <PenLine className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">מנוע תוכן</h1>
          <p className="text-sm text-muted-foreground">
            ייצור תוכן שיווקי לאינסטגרם, פייסבוק, לינקדאין, ריילס, בלוג ואימייל
          </p>
        </div>
      </div>

      <ContentView
        businessId={businessId}
        items={items}
        isGenerating={isGenerating}
      />
    </div>
  );
}
