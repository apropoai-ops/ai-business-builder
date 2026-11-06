import { ProviderConnectCard, type ProviderMeta } from "@/components/business/integrations/provider-connect-card";
import { ExternalInvoicesCard } from "@/components/business/integrations/external-invoices-card";

/**
 * חשבוניות card — generic connect form rendered from the INVOICING_PROVIDERS
 * registry contract (lib/services/invoicing/registry.ts, owned by the
 * invoicing package), plus the recently-issued documents list below it.
 *
 * Server component — passes only serializable props to the client
 * ProviderConnectCard (icon resolved there by category, connected list as a
 * plain array).
 */
export function InvoicingSection({
  businessId,
  providers,
  connectedProviders,
}: {
  businessId: string;
  providers: ProviderMeta[];
  connectedProviders: string[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <ProviderConnectCard
        businessId={businessId}
        category="invoicing"
        title="חשבוניות"
        subtitle="חיבור ספק חשבוניות ישראלי — הנפקה אוטומטית של חשבונית מס/קבלה לכל הזמנה משולמת"
        providers={providers}
        connectedProviders={connectedProviders}
      />
      <ExternalInvoicesCard businessId={businessId} />
    </div>
  );
}
