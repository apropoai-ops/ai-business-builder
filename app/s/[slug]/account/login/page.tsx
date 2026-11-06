import { redirect } from "next/navigation";

import { getPublicSiteBySlug } from "@/lib/services/website.service";
import { storeBranding } from "@/lib/storefront-brand";
import { getCustomerUser } from "@/lib/auth/customer";
import { CustomerAuthForm } from "@/components/public/account/customer-auth-form";

export const metadata = { title: "התחברות" };

export default async function AccountLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { next: nextParam, error } = await searchParams;

  const site = await getPublicSiteBySlug(slug);
  if (!site) redirect(`/s/${slug}`);
  const { brand } = storeBranding(site);

  // Only allow same-store redirect targets.
  const next =
    nextParam && nextParam.startsWith(`/s/${slug}/`)
      ? nextParam
      : `/s/${slug}/account`;

  // Already signed in → straight to the personal area.
  const user = await getCustomerUser();
  if (user) redirect(next);

  return (
    <div className="py-4">
      {error && (
        <p className="mx-auto mb-4 max-w-md rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">
          ההתחברות עם חשבון חיצוני נכשלה או שאינה זמינה כרגע — אפשר להתחבר עם
          אימייל וסיסמה
        </p>
      )}
      <CustomerAuthForm slug={slug} brand={brand} next={next} />
    </div>
  );
}
