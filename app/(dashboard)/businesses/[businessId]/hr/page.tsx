import { notFound } from "next/navigation";
import { Users2 } from "lucide-react";

import { getBusiness } from "@/lib/services/business.service";
import { listHrRoles } from "@/lib/services/hr.service";
import { getPlanForBusiness } from "@/lib/quota";
import { planAllows } from "@/lib/entitlements";
import { HrManager } from "@/components/business/hr-manager";
import { UpgradeGate } from "@/components/billing/upgrade-gate";
import { assertNavAllowed } from "@/lib/dashboard-guard";

export const metadata = { title: "גיוס ומשאבי אנוש" };

export default async function HrPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();
  assertNavAllowed(business.site_mode, "hr");

  const plan = await getPlanForBusiness(businessId);
  if (!planAllows(plan, "hr")) {
    return (
      <div className="flex flex-col gap-6">
        <UpgradeGate feature="hr" />
      </div>
    );
  }

  const roles = await listHrRoles(businessId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Users2 className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">גיוס ומשאבי אנוש</h1>
          <p className="text-sm text-muted-foreground">
            הזינו תפקיד וקבלו תיאור משרה, קריטריוני סינון ושאלות ראיון — מוכן לפרסום
          </p>
        </div>
      </div>

      <HrManager businessId={businessId} roles={roles} />
    </div>
  );
}
