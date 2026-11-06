import { notFound } from "next/navigation";
import { Zap } from "lucide-react";

import { getBusiness } from "@/lib/services/business.service";
import { listAutomations, listAutomationRuns } from "@/lib/services/automations.service";
import { AutomationsManager } from "@/components/business/automations-manager";

export const metadata = { title: "אוטומציות" };

export default async function AutomationsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();

  const [automations, runs] = await Promise.all([
    listAutomations(businessId),
    listAutomationRuns(businessId, 50),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Zap className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">אוטומציות</h1>
          <p className="text-sm text-muted-foreground">
            הגדירו כללים — כשקורה משהו בעסק, המערכת תפעל בשבילכם אוטומטית
          </p>
        </div>
      </div>

      <AutomationsManager businessId={businessId} automations={automations} runs={runs} />
    </div>
  );
}
