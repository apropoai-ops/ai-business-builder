import { notFound } from "next/navigation";
import { ShoppingBag, Package, Settings, PackagePlus } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ButtonLink } from "@/components/ui/button-link";

import { getBusiness } from "@/lib/services/business.service";
import { listProducts, listVariantsByProduct } from "@/lib/services/store.service";
import { listCoupons } from "@/lib/services/coupon.service";
import { listShippingMethods, listWarehouses } from "@/lib/services/store-shipping.service";
import { listConnections } from "@/lib/services/payment-connections.service";
import { listUnits, listReservations } from "@/lib/services/rentals.service";
import { listGatewayMeta } from "@/lib/gateways/registry";
import { getPlanForBusiness, getActiveAddonsForBusiness } from "@/lib/quota";
import { planAllows } from "@/lib/entitlements";
import { modeAllowsNav } from "@/lib/site-mode";
import { businessFitsRentals } from "@/lib/business-type";
import { StoreManager } from "@/components/business/store-manager";
import { RentalsManager } from "@/components/business/rentals-manager";
import { MarketingCard } from "@/components/business/marketing-card";
import { PaymentSettingsCard } from "@/components/business/payment-settings-card";
import { PaymentGatewaysManager } from "@/components/business/payment-gateways-manager";
import { ShippingCard } from "@/components/business/shipping-card";
import { ShippingMethodsManager } from "@/components/business/shipping-methods-manager";
import { WarehousesManager } from "@/components/business/warehouses-manager";
import { CouponsManager } from "@/components/business/coupons-manager";
import { AnnouncementCard } from "@/components/business/announcement-card";
import { SizeGuideEditor } from "@/components/business/size-guide-editor";
import { UpgradeGate } from "@/components/billing/upgrade-gate";
import { assertStoreScreenAllowed } from "@/lib/dashboard-guard";

export const metadata = { title: "חנות" };

/**
 * "החנות שלי" — everything the business sells, in one screen.
 *
 * Two catalogs live here, each with its own gate:
 *   · מוצרים  — the product catalog + the commerce stack (store_basic/full)
 *   · לינה    — "תזמון לילות", nights sold by date range (the `rentals` feature)
 *
 * They are separate entitlements on purpose — a צימר buys אתר תדמית and sells
 * only nights, a fashion store buys חנות and sells only products, and either
 * one may sell both. So neither gate may short-circuit the other: the page
 * renders whichever catalogs this business is entitled to and upsells the rest.
 */
export default async function StorePage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();
  // Nights keep this screen reachable even in a mode that sells no products.
  assertStoreScreenAllowed(business.site_mode, { sellsNights: businessFitsRentals(business) });

  const [plan, addons] = await Promise.all([
    getPlanForBusiness(businessId),
    getActiveAddonsForBusiness(businessId),
  ]);
  // A brochure/landing business is only here for the nights. Showing it a
  // products catalog — even as an upsell — would contradict the mode it bought
  // ("no selling"), so the whole product half is skipped rather than gated.
  const sellsProducts = modeAllowsNav(business.site_mode, "store");
  const hasProducts = sellsProducts && planAllows(plan, "store_basic", addons);
  const hasFullStore = sellsProducts && planAllows(plan, "store_full", addons);
  const hasNights = planAllows(plan, "rentals", addons);

  const [products, coupons, variantsByProduct, shippingMethods, warehouses, gatewayConnections] =
    await Promise.all([
      hasProducts ? listProducts(businessId) : Promise.resolve([]),
      hasProducts ? listCoupons(businessId) : Promise.resolve([]),
      hasProducts ? listVariantsByProduct(businessId) : Promise.resolve({}),
      hasProducts ? listShippingMethods(businessId) : Promise.resolve([]),
      hasProducts ? listWarehouses(businessId) : Promise.resolve([]),
      hasFullStore ? listConnections(businessId) : Promise.resolve([]),
    ]);
  const gatewayMeta = hasFullStore ? listGatewayMeta() : [];

  // The nights catalog is offered to every business on a plan that includes it
  // — not only the ones our keyword heuristic reads as hospitality. A gym
  // renting a cabin, a winery with two rooms and a plain typo in the business
  // description are all the same case, and none of them should have to guess
  // why the feature they pay for isn't on screen.
  const [units, reservations] = hasNights
    ? await Promise.all([listUnits(businessId), listReservations(businessId)])
    : [[], []];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShoppingBag className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">החנות שלי</h1>
          <p className="text-sm text-muted-foreground">
            {sellsProducts
              ? "כל מה שהעסק מוכר — מוצרים ולילות אירוח. מה שתוסיפו כאן יופיע אוטומטית באתר הציבורי שלכם."
              : "כל מה שהעסק מוכר. מה שתוסיפו כאן יופיע אוטומטית באתר הציבורי שלכם."}
          </p>
        </div>
      </div>

      {hasProducts ? (
        <Tabs defaultValue="products" dir="rtl">
          <TabsList>
            <TabsTrigger value="products" className="gap-1.5">
              <Package className="size-3.5" />
              מוצרים
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings className="size-3.5" />
              הגדרות חנות
            </TabsTrigger>
          </TabsList>

          {/* Catalog only — adding a product (manual/AI/CSV) has its own
              screen now (app/(dashboard)/businesses/[businessId]/new-product). */}
          <TabsContent value="products" className="mt-4 flex flex-col gap-4">
            <ButtonLink href={`/businesses/${businessId}/new-product`} className="gap-1.5 sm:w-fit">
              <PackagePlus className="size-4" />
              הוספת מוצר
            </ButtonLink>
            <StoreManager
              businessId={businessId}
              products={products}
              variantsByProduct={variantsByProduct}
            />
          </TabsContent>

          <TabsContent value="settings" className="mt-4 flex flex-col gap-4">
            {hasFullStore ? (
              <>
                <PaymentSettingsCard business={business} />
                <PaymentGatewaysManager
                  businessId={businessId}
                  meta={gatewayMeta}
                  connections={gatewayConnections}
                />
                <ShippingCard
                  businessId={businessId}
                  shippingFee={business.shipping_fee}
                  freeThreshold={business.free_shipping_threshold}
                />
                <ShippingMethodsManager businessId={businessId} methods={shippingMethods} />
                <WarehousesManager businessId={businessId} warehouses={warehouses} />
                <AnnouncementCard businessId={businessId} initialText={business.announcement_bar} />
                <MarketingCard business={business} />
                <CouponsManager businessId={businessId} coupons={coupons} />
              </>
            ) : (
              <UpgradeGate feature="store_full" />
            )}
            {/* Available on store_basic too — sizing isn't a full-store-only concern. */}
            <SizeGuideEditor businessId={businessId} initial={business.size_guide} />
          </TabsContent>
        </Tabs>
      ) : (
        sellsProducts && <UpgradeGate feature="store_basic" />
      )}

      {hasNights ? (
        <RentalsManager businessId={businessId} units={units} reservations={reservations} />
      ) : (
        // Only worth upselling to a business that reads as accommodation —
        // everyone else gets no nudge for a feature they'd never use.
        businessFitsRentals(business) && <UpgradeGate feature="rentals" />
      )}
    </div>
  );
}
