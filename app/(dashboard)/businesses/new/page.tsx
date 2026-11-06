import { redirect } from "next/navigation";

import { BusinessWizard } from "@/components/wizard/business-wizard";
import { requireUser } from "@/lib/auth/user";
import { getPlanForUser } from "@/lib/quota";
import { siteModeDef } from "@/lib/site-mode";
import { siteModeForPlan } from "@/lib/entitlements";

export const metadata = { title: "עסק חדש" };

export default async function NewBusinessPage() {
  const { user } = await requireUser();
  const plan = await getPlanForUser(user.id);

  // The package IS the product decision, so it is made and paid for before the
  // wizard rather than inside it. Someone without one has nothing for the
  // wizard to build — this is what replaced the old "מה בונים" step.
  if (plan.tier === "free") {
    redirect("/pricing?from=new-business");
  }

  const mode = siteModeDef(siteModeForPlan(plan.tier));

  return (
    <div className="py-4">
      <div className="mx-auto max-w-2xl px-4">
        <h1 className="text-2xl font-bold">בניית {mode.label}</h1>
        <p className="text-sm text-muted-foreground">
          תארו את הרעיון, וה-AI יבנה עבורכם תוכנית עסקית מלאה.
        </p>
      </div>
      <BusinessWizard planTier={plan.tier} />
    </div>
  );
}
