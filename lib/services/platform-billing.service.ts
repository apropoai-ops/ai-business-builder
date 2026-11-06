import { createServiceRoleClient } from "@/lib/supabase/server";
import { cardcomDriver } from "@/lib/gateways/providers/cardcom";
import { applyPlanEntitlements } from "@/lib/services/billing.service";
import { PLANS } from "@/lib/plans";
import type { GatewayCredentials } from "@/lib/gateways/types";
import type { PlanTier } from "@/types/database";

/**
 * Interim platform billing: the owner's OWN Cardcom account, charged as a
 * one-time Low-Profile payment re-run by hand each month, until real
 * recurring billing (saved token + cron + dunning) is built. Stripe Live
 * could not be activated for this business, so this replaces
 * createCheckoutSession/createPortalSession from billing.service.ts for the
 * platform's plan subscriptions specifically — add-ons stay on the dormant
 * Stripe path (lib/services/addons.service.ts) until they're worth building
 * a second time.
 *
 * These are the PLATFORM's own credentials (Apropo's Cardcom terminal), not
 * a customer's — unlike lib/gateways, which connects each business's OWN
 * account for their storefront checkout.
 */

const RENEWAL_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

function platformCardcomCreds(): GatewayCredentials | null {
  const terminalNumber = process.env.CARDCOM_TERMINAL_NUMBER;
  const apiName = process.env.CARDCOM_API_NAME;
  if (!terminalNumber || !apiName) return null;
  return { terminalNumber, apiName };
}

export function isPlatformBillingConfigured(): boolean {
  return platformCardcomCreds() !== null;
}

/** Opens a Cardcom hosted payment page for one month of the given plan. */
export async function createPlanCharge(
  userId: string,
  email: string,
  tier: Exclude<PlanTier, "free">,
): Promise<string> {
  const creds = platformCardcomCreds();
  if (!creds) throw new Error("החיוב עוד לא הופעל");

  const plan = PLANS[tier];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const s = createServiceRoleClient();

  const { data: charge, error } = await s
    .from("platform_charges")
    .insert({ user_id: userId, plan: tier, amount: plan.priceMonthly })
    .select("id")
    .single();
  if (error || !charge) throw new Error("פתיחת החיוב נכשלה");

  const { redirectUrl } = await cardcomDriver.createCheckout(
    {
      orderId: charge.id,
      amount: plan.priceMonthly,
      description: `מנוי חודשי — ${plan.name}`,
      customerEmail: email,
      successUrl: `${appUrl}/settings?billing=success`,
      cancelUrl: `${appUrl}/settings?billing=cancelled`,
      callbackUrl: `${appUrl}/api/billing/cardcom/callback`,
    },
    creds,
  );
  return redirectUrl;
}

/**
 * Verifies a Cardcom payment callback server-to-server (never trusts the
 * request body itself — see cardcomDriver.verifyCallback) and, only once per
 * charge, activates the plan for 30 days from now.
 */
export async function finalizePlatformCharge(request: Request): Promise<void> {
  const creds = platformCardcomCreds();
  if (!creds) throw new Error("החיוב עוד לא הופעל");

  const result = await cardcomDriver.verifyCallback(request, creds);
  if (!result.paid) return;

  const s = createServiceRoleClient();
  const { data: charge } = await s
    .from("platform_charges")
    .select("id, user_id, plan, status")
    .eq("id", result.orderId)
    .maybeSingle();
  // Unknown id, or a redelivery of a charge already finalized — idempotent no-op.
  if (!charge || charge.status !== "pending") return;

  await s
    .from("platform_charges")
    .update({
      status: "paid",
      provider_ref: result.providerRef ?? null,
      paid_at: new Date().toISOString(),
    })
    .eq("id", charge.id);

  const plan = charge.plan as Exclude<PlanTier, "free">;
  await s.from("subscriptions").upsert(
    {
      user_id: charge.user_id,
      plan,
      status: "active",
      provider: "cardcom",
      provider_ref: result.providerRef ?? null,
      current_period_end: new Date(Date.now() + RENEWAL_PERIOD_MS).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  await applyPlanEntitlements(charge.user_id, plan);
}
