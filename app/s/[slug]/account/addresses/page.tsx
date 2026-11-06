import { notFound } from "next/navigation";

import { getPublicSiteBySlug } from "@/lib/services/website.service";
import { storeBranding } from "@/lib/storefront-brand";
import { requireCustomerUser } from "@/lib/auth/customer";
import { listAddresses } from "@/lib/services/customer-account.service";
import { AccountNav } from "@/components/public/account/account-nav";
import { AddressManager } from "@/components/public/account/address-manager";

export const metadata = { title: "כתובות שמורות" };

export default async function AccountAddressesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getPublicSiteBySlug(slug);
  if (!site) notFound();
  const { brand } = storeBranding(site);

  const user = await requireCustomerUser(slug, `/s/${slug}/account/addresses`);
  const addresses = await listAddresses(user.id);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">כתובות שמורות</h1>
      <AccountNav slug={slug} brand={brand} />
      <AddressManager slug={slug} brand={brand} addresses={addresses} />
    </div>
  );
}
