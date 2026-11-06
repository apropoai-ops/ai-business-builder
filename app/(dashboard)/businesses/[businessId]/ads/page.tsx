import { notFound } from "next/navigation";
import { Megaphone } from "lucide-react";

import { getBusiness } from "@/lib/services/business.service";
import { getAdCampaigns } from "@/lib/services/ads.service";
import { getLatestJob } from "@/lib/services/job.service";
import { getPlanForBusiness } from "@/lib/quota";
import { planAllows } from "@/lib/entitlements";
import { AdsView } from "@/components/business/ads-view";
import { UpgradeGate } from "@/components/billing/upgrade-gate";

export const metadata = { title: "פרסום ממומן" };

export default async function AdsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();

  const plan = await getPlanForBusiness(businessId);
  if (!planAllows(plan, "ads")) {
    return (
      <div className="flex flex-col gap-6">
        <UpgradeGate feature="ads" />
      </div>
    );
  }

  const [campaigns, latestJob] = await Promise.all([
    getAdCampaigns(businessId),
    getLatestJob(businessId, "ads"),
  ]);

  const isGenerating = latestJob?.status === "running";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Megaphone className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">מחולל פרסום ממומן</h1>
          <p className="text-sm text-muted-foreground">
            קמפיינים, קהלי יעד, טקסטים וקריאייטיב ל-Meta, Google ו-TikTok
          </p>
        </div>
      </div>

      <AdsView
        businessId={businessId}
        campaigns={campaigns}
        isGenerating={isGenerating}
      />
    </div>
  );
}
