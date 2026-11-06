import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { getPublicSiteBySlug } from "@/lib/services/website.service";
import { inkOn, storeBranding } from "@/lib/storefront-brand";
import { requirePublicRoute } from "@/lib/public-route-guard";

/**
 * Chrome for the storefront personal area (/s/[slug]/account/*). Branded header
 * that links back to the store. Auth is enforced per-page (so the nested login
 * page stays public) via requireCustomerUser.
 *
 * The area serves shoppers AND booking customers, so it stays open in
 * 'website' mode; a landing page has no personal area at all.
 */
export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requirePublicRoute(slug, "account");
  const site = await getPublicSiteBySlug(slug);
  if (!site) notFound();

  const { brandName, brand, logoUrl } = storeBranding(site);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href={`/s/${slug}`} className="flex items-center gap-2.5">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={`לוגו ${brandName}`}
                className="h-8 w-auto max-w-[150px] shrink-0 object-contain"
              />
            ) : (
              <div
                className="flex size-9 items-center justify-center rounded-xl text-base font-bold text-white"
                style={{ backgroundColor: brand, color: inkOn(brand) }}
              >
                {brandName.charAt(0)}
              </div>
            )}
            <span className="text-lg font-bold">{brandName}</span>
          </Link>
          <Link
            href={`/s/${slug}`}
            className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
          >
            חזרה לחנות
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
