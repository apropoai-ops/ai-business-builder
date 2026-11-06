import { notFound } from "next/navigation";

import { getPublicSiteBySlug } from "@/lib/services/website.service";
import { storeBranding } from "@/lib/storefront-brand";
import { requireCustomerUser } from "@/lib/auth/customer";
import { listMyAppointments } from "@/lib/services/booking-self.service";
import { AccountNav } from "@/components/public/account/account-nav";
import { MyAppointments } from "@/components/public/my-appointments";

export const metadata = { title: "התורים שלי" };

export default async function AccountAppointmentsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getPublicSiteBySlug(slug);
  if (!site) notFound();
  const { brand } = storeBranding(site);

  const user = await requireCustomerUser(slug, `/s/${slug}/account/appointments`);
  const { upcoming, past } = await listMyAppointments(slug, user.id);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">התורים שלי</h1>
      <AccountNav slug={slug} brand={brand} />

      <MyAppointments slug={slug} brand={brand} upcoming={upcoming} past={past} />
    </div>
  );
}
