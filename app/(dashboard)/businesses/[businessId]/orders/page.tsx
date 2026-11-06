import { redirect } from "next/navigation";

/**
 * Orders moved into the unified customer desk. Kept as a redirect rather than
 * deleted: this path is linked from order-confirmation emails, push
 * notifications and the overview cards, and those links live in customers'
 * inboxes long after the nav changed.
 */
export default async function OrdersPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/businesses/${businessId}/crm?tab=orders`);
}
