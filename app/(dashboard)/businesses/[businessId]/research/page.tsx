import { notFound } from "next/navigation";

import { getBusiness } from "@/lib/services/business.service";
import { getMarketResearch } from "@/lib/services/market-research.service";
import { MarketResearchView } from "@/components/business/market-research-view";
import { MarketResearchWatcher } from "@/components/business/market-research-watcher";
import { assertNavAllowed } from "@/lib/dashboard-guard";

export const metadata = { title: "מחקר שוק" };

export default async function ResearchPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();
  assertNavAllowed(business.site_mode, "research");

  const research = await getMarketResearch(businessId);
  const isReady = Boolean(research?.generated_at);
  const isGenerating = !isReady;

  if (isGenerating && research === null) {
    // First time — kick off generation via watcher
    return <MarketResearchWatcher businessId={businessId} />;
  }

  if (isGenerating) {
    // Job in progress (e.g. regenerate triggered)
    return <MarketResearchWatcher businessId={businessId} />;
  }

  return <MarketResearchView businessId={businessId} research={research!} />;
}
