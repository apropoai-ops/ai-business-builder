import { notFound } from "next/navigation";
import { Plug, CreditCard, MessageCircle, BellRing, ShieldCheck, CalendarDays } from "lucide-react";

import { getBusiness } from "@/lib/services/business.service";
import { modeAllowsNav } from "@/lib/site-mode";
import { hasActiveGateway } from "@/lib/services/payment-connections.service";
import { getWhatsappConfig } from "@/lib/services/whatsapp.service";
import { emailConfigured, getRecentEmailLogs } from "@/lib/services/email.service";
import { listIntegrations } from "@/lib/services/integrations/credentials";
import { listSmsMeta } from "@/lib/services/sms/registry";
import { INVOICING_PROVIDERS } from "@/lib/services/invoicing/registry";

import { LinkStatusCard } from "@/components/business/integrations/link-status-card";
import { InvoicingSection } from "@/components/business/integrations/invoicing-section";
import { SmsSection } from "@/components/business/integrations/sms-section";
import { EmailSettingsCard } from "@/components/business/integrations/email-settings-card";
import { StoreChatCard } from "@/components/business/integrations/store-chat-card";

export const metadata = { title: "אינטגרציות" };

export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();

  const [hasGateway, whatsappConfig, integrations, logs] = await Promise.all([
    hasActiveGateway(businessId),
    getWhatsappConfig(businessId),
    listIntegrations(businessId),
    getRecentEmailLogs(businessId, 20),
  ]);

  // Plain arrays — these cross into client components (Sets don't serialize).
  const connectedInvoicing = integrations
    .filter((i) => i.category === "invoicing")
    .map((i) => i.provider);
  const connectedSms = integrations
    .filter((i) => i.category === "sms")
    .map((i) => i.provider);

  const smsProviders = listSmsMeta().map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    docsUrl: d.docsUrl,
    fields: d.credentialFields,
  }));

  const invoicingProviders = INVOICING_PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    fields: p.fields,
  }));

  const pushConfigured = Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );
  const captchaConfigured = Boolean(
    process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Plug className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">אינטגרציות</h1>
          <p className="text-sm text-muted-foreground">
            כל החיבורים לספקים חיצוניים במקום אחד — סליקה, וואטסאפ, חשבוניות, SMS, אימייל ועוד
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Both cards link to screens a non-store / landing site doesn't have
            (lib/site-mode.ts) — offering the link would land on a 404. */}
        {modeAllowsNav(business.site_mode, "store") && (
          <LinkStatusCard
            icon={CreditCard}
            title="סליקה"
            subtitle="חיבור ספק סליקה ישראלי לגביית תשלומים בחנות ישירות לחשבונכם"
            status={hasGateway ? "connected" : "not-connected"}
            href={`/businesses/${businessId}/store`}
            linkLabel="ניהול ספקי סליקה"
          />
        )}

        <LinkStatusCard
          icon={MessageCircle}
          title="WhatsApp"
          subtitle="סוכן AI שמטפל בלידים, הזמנות ושאלות נפוצות בוואטסאפ"
          status={whatsappConfig?.connected ? "connected" : "not-connected"}
          href={`/businesses/${businessId}/whatsapp`}
          linkLabel="ניהול סוכן וואטסאפ"
        />

        <InvoicingSection
          businessId={businessId}
          providers={invoicingProviders}
          connectedProviders={connectedInvoicing}
        />

        <SmsSection
          businessId={businessId}
          providers={smsProviders}
          connectedProviders={connectedSms}
        />

        <EmailSettingsCard
          businessId={businessId}
          emailFromName={business.email_from_name}
          emailReplyTo={business.email_reply_to}
          configured={emailConfigured()}
          logs={logs}
        />

        <StoreChatCard businessId={businessId} enabled={business.store_chat_enabled ?? false} />

        <LinkStatusCard
          icon={BellRing}
          title="התראות פוש"
          subtitle="התראות דחיפה לדפדפן על לידים, הזמנות ותורים חדשים"
          status={pushConfigured ? "builtin" : "not-connected"}
          hint={
            pushConfigured
              ? "מוגדר במשתני הסביבה של השרת — פעיל אוטומטית."
              : "יש להגדיר NEXT_PUBLIC_VAPID_PUBLIC_KEY ו-VAPID_PRIVATE_KEY בסביבת השרת כדי להפעיל."
          }
        />

        <LinkStatusCard
          icon={ShieldCheck}
          title="הגנת CAPTCHA"
          subtitle="הגנה מפני בוטים וספאם בטפסים הציבוריים באתר"
          status={captchaConfigured ? "builtin" : "not-connected"}
          hint={
            captchaConfigured
              ? "מוגדר במשתני הסביבה של השרת — פעיל אוטומטית."
              : "יש להגדיר TURNSTILE_SECRET_KEY ו-NEXT_PUBLIC_TURNSTILE_SITE_KEY בסביבת השרת כדי להפעיל."
          }
        />

        {modeAllowsNav(business.site_mode, "bookings") && (
          <LinkStatusCard
            icon={CalendarDays}
            title="יומן"
            subtitle="קישור פיד יומן (iCal) של התורים ליומן Google/Outlook/Apple שלכם"
            status="builtin"
            hint="פיד היומן זמין תמיד ונמצא במסך ניהול התורים."
            href={`/businesses/${businessId}/bookings`}
            linkLabel="מעבר לניהול תורים"
          />
        )}
      </div>
    </div>
  );
}
