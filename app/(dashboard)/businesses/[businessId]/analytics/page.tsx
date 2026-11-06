import { notFound } from "next/navigation";
import { BarChart3 } from "lucide-react";

import { getBusiness } from "@/lib/services/business.service";
import { getBusinessAnalytics } from "@/lib/services/analytics.service";
import { AnalyticsView } from "@/components/business/analytics-view";

export const metadata = { title: "אנליטיקס" };

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();

  const data = await getBusinessAnalytics(businessId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BarChart3 className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">אנליטיקס</h1>
          <p className="text-sm text-muted-foreground">
            תמונת מצב חיה של העסק — לידים, עסקאות, תוכן, וואטסאפ ושימוש ב-AI
          </p>
        </div>
      </div>

      <AnalyticsView data={data} />
    </div>
  );
}
