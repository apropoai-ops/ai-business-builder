import { notFound } from "next/navigation";
import { Share2 } from "lucide-react";

import { getBusiness } from "@/lib/services/business.service";
import { getSocialProfiles } from "@/lib/services/social-media.service";
import { getWebsite } from "@/lib/services/website.service";
import { getLatestJob } from "@/lib/services/job.service";
import { getPlanForBusiness } from "@/lib/quota";
import { planAllows } from "@/lib/entitlements";
import { parseSocialLinks } from "@/lib/social-links";
import { SocialView } from "@/components/business/social-view";
import { SocialLinksManager } from "@/components/business/social-links-manager";
import { UpgradeGate } from "@/components/billing/upgrade-gate";
import { assertNavAllowed } from "@/lib/dashboard-guard";

export const metadata = { title: "רשתות חברתיות" };

export default async function SocialPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();
  assertNavAllowed(business.site_mode, "social");

  const [plan, website] = await Promise.all([
    getPlanForBusiness(businessId),
    getWebsite(businessId).catch(() => null),
  ]);
  const socialLinks = parseSocialLinks(website?.social_links);

  // The link manager (basic site config) is available on EVERY plan; only the
  // AI social-media strategy below is plan-gated.
  const marketingAllowed = planAllows(plan, "social_media");

  const [profiles, latestJob] = marketingAllowed
    ? await Promise.all([
        getSocialProfiles(businessId),
        getLatestJob(businessId, "social_media"),
      ])
    : [[], null];

  const isGenerating = latestJob?.status === "running";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Share2 className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">רשתות חברתיות</h1>
          <p className="text-sm text-muted-foreground">
            קישורי הרשתות שמוצגים באתר שלכם + אסטרטגיית נוכחות מותאמת
          </p>
        </div>
      </div>

      <SocialLinksManager businessId={businessId} links={socialLinks} />

      {marketingAllowed ? (
        <SocialView
          businessId={businessId}
          profiles={profiles}
          isGenerating={isGenerating}
        />
      ) : (
        <UpgradeGate feature="social_media" />
      )}
    </div>
  );
}
