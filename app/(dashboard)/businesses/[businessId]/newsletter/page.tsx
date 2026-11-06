import { notFound } from "next/navigation";
import { Mail } from "lucide-react";

import { getBusiness } from "@/lib/services/business.service";
import { listSubscribers } from "@/lib/services/newsletter.service";
import { NewsletterSubscribers } from "@/components/business/newsletter-subscribers";
import { assertNavAllowed } from "@/lib/dashboard-guard";

export const metadata = { title: "ניוזלטר" };

export default async function NewsletterPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();
  assertNavAllowed(business.site_mode, "newsletter");

  const subscribers = await listSubscribers(businessId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Mail className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">ניוזלטר</h1>
          <p className="text-sm text-muted-foreground">
            מבקרים שנרשמו לרשימת התפוצה באתר שלכם — מוכנים לדיוור הבא
          </p>
        </div>
      </div>

      <NewsletterSubscribers subscribers={subscribers} />
    </div>
  );
}
