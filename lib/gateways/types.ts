/**
 * Payment-gateway abstraction — the shared contract for connecting a merchant's
 * OWN Israeli payment provider (Grow, Cardcom, Tranzila, PayPlus, Pelecard,
 * iCredit…) so storefront card payments are charged DIRECTLY to the merchant's
 * account (money never touches the platform). Shopify-style: the merchant picks
 * a provider, connects credentials once, and the storefront routes card
 * checkout through that provider's hosted payment page.
 *
 * Each provider is implemented as a GatewayDriver in lib/gateways/providers/*,
 * registered in lib/gateways/registry.ts. Drivers are stateless: credentials
 * are passed in per call (decrypted by the service layer just-in-time).
 */

/** A single credential input the merchant fills in when connecting a provider. */
export type GatewayCredentialField = {
  key: string;
  label: string; // Hebrew label shown in the connect form
  type: "text" | "password";
  required: boolean;
  placeholder?: string;
  help?: string; // Hebrew hint (e.g. where to find it in the provider dashboard)
};

/** Decrypted credential bag for a provider (field key → value). */
export type GatewayCredentials = Record<string, string>;

/** Everything a driver needs to open a hosted payment page for one order. */
export type GatewayCheckoutParams = {
  orderId: string;
  amount: number; // ILS, VAT-inclusive grand total
  description: string; // e.g. "הזמנה מ-{store}"
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  successUrl: string; // shopper is redirected here after paying
  cancelUrl: string; // shopper is redirected here on cancel
  callbackUrl: string; // server-to-server payment notification (webhook) URL
};

/** Result of opening a hosted payment page. */
export type GatewayCheckoutResult = { redirectUrl: string };

/**
 * Result of verifying a provider's payment callback/webhook.
 *
 * INVARIANT FOR EVERY DRIVER: `paid: true` means the PROVIDER confirmed the
 * charge — a signature the driver recomputed itself, or a server-to-server
 * status lookup. It must never mean "the request said so". Callback URLs are
 * unauthenticated and appear in the shopper's own address bar, so every field
 * of the notification is attacker-supplied; `finalizePaidCheckout` acts on
 * `paid` alone, and acting on it wrongly ships goods and issues a tax invoice
 * for money nobody paid.
 *
 * When verification cannot be performed (missing credentials, network error,
 * unparsable response), THROW — the route turns that into a 400 and the order
 * stays pending for manual confirmation. Never fall back to the unverified
 * result; that bug shipped once already (see providers/tranzila.ts).
 */
export type GatewayCallbackResult = {
  orderId: string;
  paid: boolean;
  providerRef?: string; // provider's transaction id, for reconciliation
};

export type GatewayDriver = {
  /** Stable machine key (matches the DB `provider` value + route segment). */
  key: string;
  /** Hebrew display name. */
  label: string;
  /** Short Hebrew description shown on the connect card. */
  description: string;
  /** Official API docs URL (shown to the merchant + used while implementing). */
  docsUrl: string;
  /** The credentials this provider needs to connect. */
  credentialFields: GatewayCredentialField[];
  /**
   * Opens a hosted payment page for the order and returns the redirect URL.
   * Must throw a Hebrew Error on failure.
   */
  createCheckout(
    params: GatewayCheckoutParams,
    creds: GatewayCredentials,
  ): Promise<GatewayCheckoutResult>;
  /**
   * Verifies an incoming payment callback (signature/amount/status) and returns
   * the order id + whether it was actually paid. Must NOT trust client input —
   * verify against the provider (signature or a server-side status query).
   */
  verifyCallback(
    request: Request,
    creds: GatewayCredentials,
  ): Promise<GatewayCallbackResult>;
};

/** Thrown by a driver whose live implementation isn't wired yet. */
export class GatewayNotImplementedError extends Error {
  constructor(provider: string) {
    super(`הדרייבר של ${provider} עדיין לא הופעל`);
    this.name = "GatewayNotImplementedError";
  }
}
