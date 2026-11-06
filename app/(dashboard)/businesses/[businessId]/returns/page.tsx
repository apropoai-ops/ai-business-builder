import { redirect } from "next/navigation";

/** Returns moved into the unified customer desk — see the orders page. */
export default async function ReturnsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/businesses/${businessId}/crm?tab=returns`);
}
