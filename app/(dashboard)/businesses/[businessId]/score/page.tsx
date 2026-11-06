import { notFound } from "next/navigation";
import { Gauge } from "lucide-react";

import { getBusiness } from "@/lib/services/business.service";
import { getBusinessScore } from "@/lib/services/business-score.service";
import { getInsights } from "@/lib/services/insights.service";
import { getPlanForBusiness } from "@/lib/quota";
import { planAllows } from "@/lib/entitlements";
import { ScoreView } from "@/components/business/score-view";
import { UpgradeGate } from "@/components/billing/upgrade-gate";
import { assertNavAllowed } from "@/lib/dashboard-guard";

export const metadata = { title: "ציון ותובנות" };

export default async function ScorePage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();
  assertNavAllowed(business.site_mode, "score");

  const plan = await getPlanForBusiness(businessId);
  if (!planAllows(plan, "business_score")) {
    return (
      <div className="flex flex-col gap-6">
        <UpgradeGate feature="business_score" />
      </div>
    );
  }

  const [{ score }, insights] = await Promise.all([
    getBusinessScore(businessId),
    getInsights(businessId).catch(() => null),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Gauge className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">ציון עסקי ותובנות AI</h1>
          <p className="text-sm text-muted-foreground">
            ציון 0–100 לפי 5 תחומים, וניתוח חכם עם המלצות לפעולה
          </p>
        </div>
      </div>

      <ScoreView businessId={businessId} score={score} insights={insights} />
    </div>
  );
}
