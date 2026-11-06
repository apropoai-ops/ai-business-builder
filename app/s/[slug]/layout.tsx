import { notFound } from "next/navigation";

import { getPublicSiteBasicsBySlug } from "@/lib/services/website.service";

/**
 * Public-site shell.
 *
 * Its job is to 404 a slug that doesn't exist or isn't published — and to do it
 * HERE rather than in each page, because the HTTP STATUS depends on it. Next can
 * only send 404 while the response hasn't started streaming, so a `notFound()`
 * further down (or behind a `loading.tsx` Suspense boundary, which this segment
 * deliberately no longer has) arrives after the 200 headers are already on the
 * wire and produces a soft 404 that search engines happily index.
 *
 * Doing it here also means a dead slug costs ONE small query instead of the
 * full page's fan-out — most of that traffic is crawlers and stale links.
 *
 * The lookup is React-`cache`d, so the sub-route guards and the pages below
 * reuse this same round trip.
 */
export default async function PublicSiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // A clean "no such site" 404s; a lookup that THREW is a transient failure,
  // and taking a real storefront offline over a blip would be worse.
  const basics = await getPublicSiteBasicsBySlug(slug).then(
    (value) => ({ resolved: true, value }),
    () => ({ resolved: false, value: null }),
  );
  if (basics.resolved && !basics.value) notFound();

  return <>{children}</>;
}
