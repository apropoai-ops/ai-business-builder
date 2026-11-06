import { notFound } from "next/navigation";
import Link from "next/link";
import { BedDouble, ExternalLink } from "lucide-react";

import { getBusiness } from "@/lib/services/business.service";
import { getPlanForBusiness, getActiveAddonsForBusiness } from "@/lib/quota";
import { planAllows } from "@/lib/entitlements";
import { UpgradeGate } from "@/components/billing/upgrade-gate";
import { RentalBoard } from "@/components/business/rentals/rental-board";
import {
  expireStaleHolds, loadBoard, loadStats,
} from "@/lib/services/rentals-pms.service";
import { addDays, monthBounds, todayIL } from "@/lib/rentals";

export const metadata = { title: "לוח לילות" };

/**
 * "לוח לילות" — the property-management screen.
 *
 * This route used to be a redirect into /store, where nights lived as one card
 * beside the product catalog. That was right when the feature was a list of
 * units and a list of reservations; it stopped being right the moment the
 * feature grew a calendar, an availability engine and a booking desk, none of
 * which fit in a card. The חנות screen keeps its entry point (a link, not a
 * duplicate) so nobody has to relearn where nights live.
 */
export default async function RentalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const { businessId } = await params;
  const { m } = await searchParams;

  const business = await getBusiness(businessId);
  if (!business) notFound();

  const [plan, addons] = await Promise.all([
    getPlanForBusiness(businessId),
    getActiveAddonsForBusiness(businessId),
  ]);
  if (!planAllows(plan, "rentals", addons)) {
    return (
      <div className="flex flex-col gap-4">
        <Header businessId={businessId} />
        <UpgradeGate feature="rentals" />
      </div>
    );
  }

  // An abandoned unpaid request holds real nights, so it is swept on the way in
  // rather than by a cron the deployment may or may not have.
  await expireStaleHolds([businessId]).catch(() => 0);

  const today = todayIL();
  // The anchor month comes from the URL so a shared link opens the same view.
  const anchor = /^\d{4}-\d{2}$/.test(m ?? "") ? `${m}-01` : today;
  const [y, mo] = anchor.split("-").map(Number);
  const bounds = monthBounds(y, mo);

  // One month either side: the board can page to the neighbouring month without
  // a round trip, and a stay spanning the boundary is already in hand.
  const [board, stats] = await Promise.all([
    loadBoard([businessId], addDays(bounds.from, -31), addDays(bounds.to, 31)),
    loadStats([businessId]),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Header businessId={businessId} />
      <RentalBoard
        businessId={businessId}
        units={board.units}
        unitTypes={board.unitTypes}
        bookings={board.bookings}
        stats={stats}
        initialAnchor={anchor}
      />
    </div>
  );
}

function Header({ businessId }: { businessId: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BedDouble className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">לוח לילות</h1>
          <p className="text-sm text-muted-foreground">
            זמינות, הזמנות וחסימות של כל היחידות — לחיצה על לילה פנוי פותחת הזמנה.
          </p>
        </div>
      </div>
      <Link
        href={`/businesses/${businessId}/store`}
        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition hover:bg-muted"
      >
        ניהול היחידות
        <ExternalLink className="size-3.5" />
      </Link>
    </div>
  );
}
