import { notFound, redirect } from "next/navigation";
import { FileText } from "lucide-react";

import {
  getBusiness,
  getBusinessProfile,
} from "@/lib/services/business.service";
import { Card, CardContent } from "@/components/ui/card";
import { PlanView } from "@/components/business/plan-view";
import { GenerateButton } from "@/components/business/generate-button";
import { assertNavAllowed } from "@/lib/dashboard-guard";

export const metadata = { title: "תוכנית עסקית" };

export default async function PlanPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();
  assertNavAllowed(business.site_mode, "plan");

  const profile = await getBusinessProfile(businessId);
  const planReady = Boolean(profile?.generated_at);

  // Generation in progress → send to overview where progress is shown.
  if (!planReady && business.status === "generating") {
    redirect(`/businesses/${businessId}/overview`);
  }

  if (!planReady || !profile) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="size-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">עדיין אין תוכנית עסקית</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              הפעילו את ה-AI כדי לבנות תוכנית עסקית מלאה עבור העסק.
            </p>
          </div>
          <GenerateButton businessId={businessId} />
        </CardContent>
      </Card>
    );
  }

  return <PlanView businessId={businessId} profile={profile} />;
}
