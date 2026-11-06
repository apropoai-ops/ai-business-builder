import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Package,
  MapPin,
  CreditCard,
  CalendarDays,
  ChevronLeft,
} from "lucide-react";

import { getPublicSiteBySlug } from "@/lib/services/website.service";
import { storeBranding } from "@/lib/storefront-brand";
import { requireCustomerUser } from "@/lib/auth/customer";
import {
  getCustomerOrders,
  getCustomerProfile,
  listAddresses,
  listPaymentMethods,
} from "@/lib/services/customer-account.service";
import { getLoyaltyBalance } from "@/lib/services/loyalty.service";
import { getOrCreateReferralCode, getReferralCount } from "@/lib/services/referral.service";
import { listMyAppointments } from "@/lib/services/booking-self.service";
import { AccountNav } from "@/components/public/account/account-nav";
import { SignOutButton } from "@/components/public/account/sign-out-button";
import { ProfileForm } from "@/components/public/account/profile-form";
import { ReferralCard } from "@/components/public/account/referral-card";

export const metadata = { title: "האזור האישי" };

export default async function AccountHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await getPublicSiteBySlug(slug);
  if (!site) notFound();
  const { brand } = storeBranding(site);

  const user = await requireCustomerUser(slug);
  const [orders, profile, addresses, methods, points, appts] =
    await Promise.all([
      getCustomerOrders(slug, user.id),
      getCustomerProfile(user.id),
      listAddresses(user.id),
      listPaymentMethods(user.id),
      site.business.loyalty_enabled
        ? getLoyaltyBalance(site.website.business_id, user.id)
        : Promise.resolve(0),
      listMyAppointments(slug, user.id, user.email),
    ]);
  const pointsValue = Math.round(points * (Number(site.business.loyalty_value) || 0));

  const referral = site.business.referral_enabled
    ? {
        code: await getOrCreateReferralCode(user.id),
        count: await getReferralCount(user.id),
        points: Number(site.business.referral_points) || 0,
      }
    : null;

  const greetName =
    profile?.full_name ||
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split("@")[0] ||
    "";

  const upcomingCount = appts.upcoming.filter(
    (b) => b.status !== "cancelled",
  ).length;

  const cards = [
    {
      href: `/s/${slug}/account/appointments`,
      icon: CalendarDays,
      label: "התורים שלי",
      value:
        upcomingCount > 0 ? `${upcomingCount} תורים קרובים` : "אין תורים קרובים",
    },
    {
      href: `/s/${slug}/account/orders`,
      icon: Package,
      label: "ההזמנות שלי",
      value: `${orders.length} הזמנות`,
    },
    {
      href: `/s/${slug}/account/addresses`,
      icon: MapPin,
      label: "כתובות שמורות",
      value: `${addresses.length} כתובות`,
    },
    {
      href: `/s/${slug}/account/payment-methods`,
      icon: CreditCard,
      label: "אמצעי תשלום",
      value: `${methods.length} שמורים`,
    },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">שלום{greetName ? `, ${greetName}` : ""} 👋</h1>
          <p className="mt-1 text-sm text-zinc-500">האזור האישי שלך</p>
        </div>
        <SignOutButton slug={slug} />
      </div>

      <AccountNav slug={slug} brand={brand} />

      {site.business.loyalty_enabled && (
        <div
          className="mb-6 flex items-center justify-between rounded-2xl p-5 text-white shadow-sm"
          style={{ background: `linear-gradient(120deg, ${brand}, ${brand}cc)` }}
        >
          <div>
            <div className="text-sm opacity-90">הנקודות שלי</div>
            <div className="text-3xl font-extrabold">{points.toLocaleString("he-IL")}</div>
          </div>
          <div className="text-end text-sm opacity-90">
            שווי לקנייה
            <div className="text-xl font-bold">₪{pointsValue.toLocaleString("he-IL")}</div>
          </div>
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.href}
              href={c.href}
              className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-3 flex items-center justify-between">
                <Icon className="size-6" style={{ color: brand }} />
                <ChevronLeft className="size-4 text-zinc-300 transition group-hover:-translate-x-0.5" />
              </div>
              <div className="font-semibold">{c.label}</div>
              <div className="mt-0.5 text-sm text-zinc-500">{c.value}</div>
            </Link>
          );
        })}
      </div>

      {referral && (
        <ReferralCard
          slug={slug}
          brand={brand}
          code={referral.code}
          count={referral.count}
          points={referral.points}
        />
      )}

      <ProfileForm
        slug={slug}
        brand={brand}
        email={user.email ?? ""}
        fullName={greetName}
        phone={profile?.phone ?? ""}
      />
    </div>
  );
}
