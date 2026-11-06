import { notFound } from "next/navigation";
import { Star } from "lucide-react";

import { getBusiness } from "@/lib/services/business.service";
import { listReviews } from "@/lib/services/reviews.service";
import { ReviewsManager } from "@/components/business/reviews-manager";

export const metadata = { title: "ביקורות לקוחות" };

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();

  const reviews = await listReviews(businessId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Star className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">ביקורות לקוחות</h1>
          <p className="text-sm text-muted-foreground">
            לקוחות משאירים ביקורת באתר — כאן מאשרים מה יתפרסם
          </p>
        </div>
      </div>

      <ReviewsManager businessId={businessId} reviews={reviews} />
    </div>
  );
}
