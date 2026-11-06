import { redirect } from "next/navigation";

/**
 * מיתוג was merged into "אתר ומיתוג" (the /website screen).
 *
 * Kept as a redirect rather than deleted: this URL sits in owners' bookmarks,
 * in the browser history of anyone who used the old nav, and in links inside
 * older generated content. A 404 would be a worse answer than the screen they
 * were actually looking for.
 */
export default async function BrandingRedirect({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/businesses/${businessId}/website`);
}
