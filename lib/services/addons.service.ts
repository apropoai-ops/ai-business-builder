import Stripe from "stripe";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { ADDONS } from "@/lib/plans";

/**
 * Add-on purchases. Mirrors lib/services/billing.service.ts's subscription
 * checkout pattern, but each add-on is its own independent Stripe
 * subscription (mode: "subscription") with a recurring monthly ILS
 * price_data line item built on the fly from the ADDONS catalog — no
 * pre-created Stripe Price ids needed, unlike the plan tiers.
 *
 * purchased_addons (migration 0051) is the local mirror; all writes happen
 * from the webhook (service-role), this file only reads + creates the
 * Checkout Session.
 */

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("החיוב עוד לא הופעל — חסר מפתח Stripe");
  return new Stripe(key);
}

function addonDef(addonKey: string) {
  const def = ADDONS.find((a) => a.key === addonKey);
  if (!def) throw new Error("תוספת לא קיימת");
  return def;
}

/** Active (status='active') add-on keys purchased by this user. */
export async function getActiveAddons(userId: string): Promise<Set<string>> {
  const s = createServiceRoleClient();
  const { data } = await s
    .from("purchased_addons")
    .select("addon_key")
    .eq("user_id", userId)
    .eq("status", "active");
  return new Set((data ?? []).map((r) => r.addon_key));
}

/** Does this user have the given add-on active right now? */
export async function hasAddon(userId: string, addonKey: string): Promise<boolean> {
  const active = await getActiveAddons(userId);
  return active.has(addonKey);
}

/**
 * Records a completed add-on purchase (webhook: checkout.session.completed,
 * metadata.kind === 'addon'). Idempotent on stripe_subscription_id — Stripe
 * may redeliver the same event, and upsert-on-conflict just re-marks active.
 */
export async function recordAddonPurchase(args: {
  userId: string;
  addonKey: string;
  stripeSubscriptionId: string;
  stripeItemId?: string | null;
}): Promise<void> {
  const s = createServiceRoleClient();
  await s.from("purchased_addons").upsert(
    {
      user_id: args.userId,
      addon_key: args.addonKey,
      stripe_subscription_id: args.stripeSubscriptionId,
      stripe_item_id: args.stripeItemId ?? null,
      status: "active",
      canceled_at: null,
    },
    { onConflict: "stripe_subscription_id" },
  );
}

/**
 * Marks an add-on subscription canceled (webhook: customer.subscription.deleted,
 * or .updated when Stripe reports a terminal status). No-op if the
 * subscription id isn't a known add-on purchase.
 */
export async function markAddonCanceled(stripeSubscriptionId: string): Promise<void> {
  const s = createServiceRoleClient();
  await s
    .from("purchased_addons")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("stripe_subscription_id", stripeSubscriptionId);
}

/**
 * Starts a Stripe Checkout Session (subscription mode) for one add-on.
 * Builds the recurring line item from ADDONS via price_data (no pre-created
 * Stripe Price id needed — the add-on price lives only in lib/plans.ts).
 * Guards against double-purchasing an already-active add-on.
 */
export async function createAddonCheckoutSession(args: {
  userId: string;
  addonKey: string;
  customerEmail?: string;
}): Promise<string> {
  const def = addonDef(args.addonKey);

  if (await hasAddon(args.userId, args.addonKey)) {
    throw new Error(`התוספת "${def.label}" כבר פעילה אצלכם`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  const session = await stripeClient().checkout.sessions.create({
    mode: "subscription",
    customer_email: args.customerEmail || undefined,
    line_items: [
      {
        price_data: {
          currency: "ils",
          recurring: { interval: "month" },
          unit_amount: Math.round(def.priceMonthly * 100), // agorot
          product_data: {
            name: def.label,
            description: def.description,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/pricing?addon=success`,
    cancel_url: `${appUrl}/pricing?addon=cancel`,
    metadata: { kind: "addon", addon_key: args.addonKey, user_id: args.userId },
    subscription_data: {
      metadata: { kind: "addon", addon_key: args.addonKey, user_id: args.userId },
    },
  });
  if (!session.url) throw new Error("יצירת עמוד התשלום נכשלה");
  return session.url;
}
