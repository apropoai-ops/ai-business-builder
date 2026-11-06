import { notFound } from "next/navigation";

import { getPublicSiteBySlug } from "@/lib/services/website.service";
import { storeBranding } from "@/lib/storefront-brand";
import { requireCustomerUser } from "@/lib/auth/customer";
import { listPaymentMethods } from "@/lib/services/customer-account.service";
import { AccountNav } from "@/components/public/account/account-nav";
import { PaymentMethodsManager } from "@/components/public/account/payment-methods-manager";

export const metadata = { title: "אמצעי תשלום" };

export default async function AccountPaymentMethodsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getPublicSiteBySlug(slug);
  if (!site) notFound();
  const { brand } = storeBranding(site);

  const user = await requireCustomerUser(slug, `/s/${slug}/account/payment-methods`);
  const methods = await listPaymentMethods(user.id);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">אמצעי תשלום</h1>
      <AccountNav slug={slug} brand={brand} />
      <PaymentMethodsManager slug={slug} brand={brand} methods={methods} />
    </div>
  );
}
