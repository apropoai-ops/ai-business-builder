import { ProviderConnectCard, type ProviderMeta } from "@/components/business/integrations/provider-connect-card";

/**
 * SMS connect card — provider select (Twilio / InforU) rendered generically
 * from lib/services/sms/registry.ts, plus a short explanation of Israeli
 * sender-ID rules (a custom alphanumeric sender needs pre-approval from the
 * provider; an unapproved one falls back to a shared default sender).
 *
 * Server component — passes only serializable props to the client
 * ProviderConnectCard (icon resolved there by category, connected list as a
 * plain array).
 */
export function SmsSection({
  businessId,
  providers,
  connectedProviders,
}: {
  businessId: string;
  providers: ProviderMeta[];
  connectedProviders: string[];
}) {
  return (
    <ProviderConnectCard
      businessId={businessId}
      category="sms"
      title="SMS"
      subtitle="שליחת הודעות SMS ללקוחות (תזכורות תור, עדכוני הזמנה)"
      providers={providers}
      connectedProviders={connectedProviders}
    >
      <p className="text-xs text-muted-foreground">
        חשוב: שם שולח מותאם אישית (Sender ID) בישראל דורש בדרך כלל אישור מראש מול
        הספק — עד לאישור יוצג שם שולח ברירת מחדל של הספק. מומלץ לפנות לתמיכת
        הספק שבחרתם כדי לרשום שם שולח לעסק שלכם.
      </p>
    </ProviderConnectCard>
  );
}
