import Stripe from "stripe";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/plans";
import { siteModeForPlan, siteModeRank } from "@/lib/entitlements";
import { resolveSiteMode } from "@/lib/site-mode";
import type { PlanTier } from "@/types/database";

/**
 * Stripe billing. Fully built but dormant until the env keys are set:
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
 *   STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO, STRIPE_PRICE_BUSINESS
 * Until then isBillingConfigured() is false and the UI shows a
 * "payments coming soon" state instead of checkout buttons.
 */

export function isBillingConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_PRICE_STARTER &&
    process.env.STRIPE_PRICE_PRO &&
    process.env.STRIPE_PRICE_BUSINESS,
  );
}

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("החיוב עוד לא הופעל — חסר מפתח Stripe");
  return new Stripe(key);
}

const PRICE_ENV: Record<Exclude<PlanTier, "free">, string> = {
  starter: "STRIPE_PRICE_STARTER",
  pro: "STRIPE_PRICE_PRO",
  business: "STRIPE_PRICE_BUSINESS",
};

function priceIdFor(tier: Exclude<PlanTier, "free">): string {
  const id = process.env[PRICE_ENV[tier]];
  if (!id) throw new Error(`חסר price id לתוכנית ${PLANS[tier].name}`);
  return id;
}

/**
 * Refuses to open a checkout whose Stripe Price doesn't match the price the
 * customer was just shown.
 *
 * The two live in different systems: PLANS[tier].priceMonthly is in this repo,
 * the amount actually charged is a Stripe Price object created by hand. Re-price
 * a package without recreating the Price and the pricing page says ₪199 while
 * the card is charged the old amount — the kind of bug that becomes a chargeback
 * and a complaint, and that nothing in the app would otherwise notice.
 *
 * Fails closed with an explicit Hebrew error rather than charging the wrong sum.
 */
async function assertPriceMatchesPlan(
  tier: Exclude<PlanTier, "free">,
  priceId: string,
): Promise<void> {
  const plan = PLANS[tier];
  const price = await stripeClient().prices.retrieve(priceId);

  const expectedAgorot = Math.round(plan.priceMonthly * 100);
  const actual = price.unit_amount;
  const currency = price.currency?.toLowerCase();
  const interval = price.recurring?.interval;

  if (actual !== expectedAgorot || currency !== "ils" || interval !== "month") {
    throw new Error(
      `תקלת הגדרות חיוב בחבילת ${plan.name}: המחיר באתר הוא ₪${plan.priceMonthly} לחודש, ` +
        `אך ב-Stripe מוגדר ${actual != null ? `₪${actual / 100}` : "סכום לא ידוע"} ` +
        `(${currency ?? "?"}, ${interval ?? "לא מנוי חודשי"}). ` +
        `יש ליצור Price חדש ב-Stripe ולעדכן את ${PRICE_ENV[tier]}. לא בוצע חיוב.`,
    );
  }
}

async function getOrCreateCustomer(userId: string, email: string): Promise<string> {
  const s = createServiceRoleClient();
  const { data: sub } = await s
    .from("subscriptions").select("stripe_customer_id")
    .eq("user_id", userId).maybeSingle();
  if (sub?.stripe_customer_id) return sub.stripe_customer_id;

  const customer = await stripeClient().customers.create({
    email,
    metadata: { user_id: userId },
  });
  await s.from("subscriptions").upsert(
    { user_id: userId, stripe_customer_id: customer.id },
    { onConflict: "user_id" },
  );
  return customer.id;
}

export async function createCheckoutSession(
  userId: string,
  email: string,
  tier: Exclude<PlanTier, "free">,
): Promise<string> {
  const priceId = priceIdFor(tier);
  // Never charge an amount other than the one on the pricing page.
  await assertPriceMatchesPlan(tier, priceId);

  const customerId = await getOrCreateCustomer(userId, email);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  const session = await stripeClient().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/settings?billing=success`,
    cancel_url: `${appUrl}/settings?billing=cancelled`,
    metadata: { user_id: userId, plan: tier },
    subscription_data: { metadata: { user_id: userId, plan: tier } },
  });
  if (!session.url) throw new Error("יצירת עמוד התשלום נכשלה");
  return session.url;
}

export async function createPortalSession(userId: string): Promise<string> {
  const s = createServiceRoleClient();
  const { data: sub } = await s
    .from("subscriptions").select("stripe_customer_id")
    .eq("user_id", userId).maybeSingle();
  if (!sub?.stripe_customer_id) throw new Error("אין מנוי פעיל לנהל");

  const portal = await stripeClient().billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
  });
  return portal.url;
}

/**
 * Whether the user already had an active/trialing subscription BEFORE this
 * call — check this ahead of syncSubscriptionFromStripe to decide whether a
 * checkout.session.completed delivery is a genuine new activation (send the
 * welcome email) or a Stripe redelivery of one already synced (skip it, or
 * the customer gets the Hebrew welcome email twice).
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const s = createServiceRoleClient();
  const { data } = await s
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.status === "active" || data?.status === "trialing";
}

/**
 * Promotes a user's plan + carries their businesses' site_mode up with it.
 * Shared by every billing path (Stripe webhook sync, the interim Cardcom
 * platform-billing flow) so this invariant is written once.
 *
 * The package IS the site mode now that the dashboard's "מה בונים" switcher
 * is gone, so an upgrade has to carry the owner's businesses up with it —
 * otherwise someone who starts paying for חנות keeps the אתר תדמית they had
 * and no longer has any control that changes it.
 *
 * Strictly one-directional — call this ONLY on a genuine active-plan
 * activation. A lapsed or downgraded subscription must never rewrite a live
 * store back down to a landing page: that would delete the customer's
 * storefront out from under them over a failed card, and losing access to
 * features is a very different thing from losing the site.
 */
export async function applyPlanEntitlements(
  userId: string,
  plan: Exclude<PlanTier, "free">,
): Promise<void> {
  const s = createServiceRoleClient();
  await s.from("profiles").update({ plan }).eq("id", userId);

  const target = siteModeForPlan(plan);
  const { data: owned } = await s
    .from("businesses")
    .select("id, site_mode")
    .eq("owner_id", userId);

  const promote = (owned ?? [])
    .filter((b) => siteModeRank(resolveSiteMode(b.site_mode)) < siteModeRank(target))
    .map((b) => b.id);

  if (promote.length > 0) {
    await s.from("businesses").update({ site_mode: target }).in("id", promote);
  }
}

/** Applies a subscription state from a Stripe webhook event. */
export async function syncSubscriptionFromStripe(args: {
  userId: string;
  plan: PlanTier;
  status: string;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
}): Promise<void> {
  const s = createServiceRoleClient();
  const active = args.status === "active" || args.status === "trialing";
  const effectivePlan: PlanTier = active ? args.plan : "free";

  await s.from("subscriptions").upsert(
    {
      user_id: args.userId,
      plan: effectivePlan,
      status: args.status,
      stripe_subscription_id: args.stripeSubscriptionId,
      current_period_end: args.currentPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (active && effectivePlan !== "free") {
    await applyPlanEntitlements(args.userId, effectivePlan);
  } else {
    await s.from("profiles").update({ plan: effectivePlan }).eq("id", args.userId);
  }
}

/**
 * Retrieves the live status + current period end for a subscription straight
 * from Stripe. Used on checkout.session.completed (where the session payload
 * doesn't carry the period end) so the renewal date is set immediately rather
 * than waiting for the next customer.subscription.updated event.
 */
export async function getStripeSubscriptionState(
  subscriptionId: string,
): Promise<{ status: string; currentPeriodEnd: string | null }> {
  const sub = await stripeClient().subscriptions.retrieve(subscriptionId);
  const periodEnd = sub.items.data[0]?.current_period_end;
  return {
    status: sub.status,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  };
}

export function constructWebhookEvent(payload: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET not set");
  return stripeClient().webhooks.constructEvent(payload, signature, secret);
}
