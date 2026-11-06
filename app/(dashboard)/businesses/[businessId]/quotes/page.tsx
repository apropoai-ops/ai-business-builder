import { notFound } from "next/navigation";
import { FileText } from "lucide-react";

import { getBusiness } from "@/lib/services/business.service";
import { listQuotes } from "@/lib/services/quotes.service";
import { getPlanForBusiness } from "@/lib/quota";
import { planAllows } from "@/lib/entitlements";
import { QuotesManager } from "@/components/business/quotes-manager";
import type { QuoteBrand } from "@/components/business/quote-pdf-button";
import { getBrandAssets } from "@/lib/services/branding.service";
import { pickBrandColor, type Palette } from "@/lib/storefront-brand";
import { UpgradeGate } from "@/components/billing/upgrade-gate";
import { assertNavAllowed } from "@/lib/dashboard-guard";

export const metadata = { title: "הצעות מחיר" };

export default async function QuotesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();
  assertNavAllowed(business.site_mode, "quotes");

  const plan = await getPlanForBusiness(businessId);
  if (!planAllows(plan, "quotes")) {
    return (
      <div className="flex flex-col gap-6">
        <UpgradeGate feature="quotes" />
      </div>
    );
  }

  // Brand identity for the downloadable PDF, resolved the same way the public
  // quote page does it (color_palette is objects, not colour strings).
  const [quotes, brandAssets] = await Promise.all([
    listQuotes(businessId),
    getBrandAssets(businessId).catch(() => null),
  ]);
  const brand: QuoteBrand = {
    businessName: brandAssets?.brand_name ?? business.name ?? "העסק",
    accent: pickBrandColor((brandAssets?.color_palette as Palette | null) ?? null),
    logoUrl: brandAssets?.logo_url ?? null,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FileText className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">הצעות מחיר</h1>
          <p className="text-sm text-muted-foreground">
            בנו הצעת מחיר, שלחו ללקוח קישור לצפייה — והוא מאשר בלחיצה
          </p>
        </div>
      </div>

      <QuotesManager businessId={businessId} quotes={quotes} brand={brand} />
    </div>
  );
}
