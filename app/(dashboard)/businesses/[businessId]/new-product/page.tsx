import Link from "next/link";
import { notFound } from "next/navigation";
import { PackagePlus, ArrowLeft } from "lucide-react";

import { getBusiness } from "@/lib/services/business.service";
import { getPlanForBusiness, getActiveAddonsForBusiness } from "@/lib/quota";
import { planAllows } from "@/lib/entitlements";
import { modeAllowsNav } from "@/lib/site-mode";
import { AddProductForm } from "@/components/business/add-product-form";
import { ProductCsv } from "@/components/business/product-csv";
import { UpgradeGate } from "@/components/billing/upgrade-gate";
import { assertNavAllowed } from "@/lib/dashboard-guard";

export const metadata = { title: "הוספת מוצר" };

/**
 * "הוספת מוצר" — its own screen, split out of "החנות שלי" so adding a
 * product (manual form, AI-generate, or CSV bulk import) has dedicated
 * space instead of sharing the page with catalog browsing and the
 * operational settings (payments/shipping/coupons/etc).
 */
export default async function NewProductPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();
  assertNavAllowed(business.site_mode, "new-product");

  const [plan, addons] = await Promise.all([
    getPlanForBusiness(businessId),
    getActiveAddonsForBusiness(businessId),
  ]);
  const sellsProducts = modeAllowsNav(business.site_mode, "store");
  const hasProducts = sellsProducts && planAllows(plan, "store_basic", addons);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PackagePlus className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">הוספת מוצר</h1>
            <p className="text-sm text-muted-foreground">
              הוסיפו כמה מוצרים שתרצו ברצף — ידנית, ב-AI, או מקובץ CSV.
            </p>
          </div>
        </div>
        <Link
          href={`/businesses/${businessId}/store`}
          className="flex shrink-0 items-center gap-1.5 text-sm text-primary hover:underline"
        >
          לצפייה בקטלוג
          <ArrowLeft className="size-3.5" />
        </Link>
      </div>

      {hasProducts ? (
        <>
          <AddProductForm businessId={businessId} />
          <ProductCsv businessId={businessId} />
        </>
      ) : (
        sellsProducts && <UpgradeGate feature="store_basic" />
      )}
    </div>
  );
}
