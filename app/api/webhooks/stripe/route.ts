import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import {
  constructWebhookEvent,
  getStripeSubscriptionState,
  hasActiveSubscription,
  syncSubscriptionFromStripe,
} from "@/lib/services/billing.service";
import { finalizePaidStoreOrder } from "@/lib/services/store-checkout.service";
import { finalizeRentalBooking } from "@/lib/services/rentals.service";
import { sendPlanWelcomeEmail } from "@/lib/services/email.service";
import { recordAddonPurchase, markAddonCanceled } from "@/lib/services/addons.service";
import type { PlanTier } from "@/types/database";

export const maxDuration = 30;

const VALID_PLANS: PlanTier[] = ["starter", "pro", "business"];

function planFromMetadata(meta: Stripe.Metadata | null): PlanTier | null {
  const plan = meta?.plan as PlanTier | undefined;
  return plan && VALID_PLANS.includes(plan) ? plan : null;
}

/**
 * POST /api/webhooks/stripe — subscription lifecycle sync.
 * Handles: checkout.session.completed, customer.subscription.updated/deleted.
 * Signature-verified; unknown events are acknowledged and ignored.
 *
 * ⚠️ NEVER let a host/canonical redirect cover /api/. Stripe does not follow
 * 3xx on webhook delivery — it books the redirect as a failed attempt and
 * retries into the same wall. The canonical-host rule in vercel.json shipped
 * with the custom domain matching `/:path*`, which swallowed this endpoint and
 * silently un-finalized every card payment for a week: charges succeeded at
 * Stripe, but no order/booking was ever marked paid, so there was no dashboard
 * row, no confirmation email and no receipt, and the symptom looked like an
 * email bug rather than a routing one. `vercel.json` now excludes `/api/` from
 * that redirect (`/:path((?!api/).*)`) — keep it that way. Diagnose this class
 * of failure with `pending_webhooks` on a Stripe event: non-zero means nothing
 * ever accepted the delivery.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new NextResponse("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(await request.text(), signature);
  } catch {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        const buyerEmail = session.customer_details?.email ?? session.customer_email ?? null;

        // Storefront card order (a shopper paying a business) — finalize it.
        if (session.metadata?.kind === "store_order" && session.payment_status === "paid") {
          const orderId = session.metadata.order_id;
          if (orderId) await finalizePaidStoreOrder(orderId, buyerEmail);
          break;
        }

        // Vacation-rental reservation — mark paid + confirmed (blocks the dates).
        if (session.metadata?.kind === "rental_booking" && session.payment_status === "paid") {
          const bookingId = session.metadata.booking_id;
          if (bookingId) await finalizeRentalBooking(bookingId, buyerEmail);
          break;
        }

        // Paid add-on subscription (lib/plans.ts ADDONS) — record it active.
        if (session.metadata?.kind === "addon") {
          const addonUserId = session.metadata.user_id;
          const addonKey = session.metadata.addon_key;
          const subscriptionId =
            typeof session.subscription === "string" ? session.subscription : null;
          if (addonUserId && addonKey && subscriptionId) {
            await recordAddonPurchase({
              userId: addonUserId,
              addonKey,
              stripeSubscriptionId: subscriptionId,
            });
          }
          break;
        }

        const userId = session.metadata?.user_id;
        const plan = planFromMetadata(session.metadata);
        if (userId && plan) {
          // Snapshot BEFORE syncing: only a genuine new activation (not yet
          // active) gets the welcome email. Without this, a Stripe redelivery
          // of this same event (timeout retry or manual replay) re-sends it.
          const alreadyActive = await hasActiveSubscription(userId);
          const subscriptionId =
            typeof session.subscription === "string" ? session.subscription : null;
          // Pull live status + renewal date from Stripe (the session payload
          // doesn't include the period end). Falls back gracefully on error.
          let status = "active";
          let currentPeriodEnd: string | null = null;
          if (subscriptionId) {
            try {
              const state = await getStripeSubscriptionState(subscriptionId);
              status = state.status;
              currentPeriodEnd = state.currentPeriodEnd;
            } catch {
              // keep defaults — customer.subscription.updated will reconcile
            }
          }
          await syncSubscriptionFromStripe({
            userId,
            plan,
            status,
            stripeSubscriptionId: subscriptionId,
            currentPeriodEnd,
          });
          // Best-effort Hebrew welcome email to the subscriber (never throws).
          // Only on the actual transition into an active plan — see
          // hasActiveSubscription above.
          const email = session.customer_details?.email ?? session.customer_email ?? null;
          if (email && !alreadyActive) await sendPlanWelcomeEmail(email, plan);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;

        // Add-on subscription (separate Stripe subscription from the
        // platform plan) — sync its active/canceled status.
        if (sub.metadata?.kind === "addon") {
          const canceled =
            event.type === "customer.subscription.deleted" ||
            sub.status === "canceled" ||
            sub.status === "unpaid" ||
            sub.status === "incomplete_expired";
          if (canceled) await markAddonCanceled(sub.id);
          break;
        }

        const userId = sub.metadata?.user_id;
        const plan = planFromMetadata(sub.metadata);
        if (userId && plan) {
          const periodEnd = sub.items.data[0]?.current_period_end;
          await syncSubscriptionFromStripe({
            userId,
            plan,
            status: event.type === "customer.subscription.deleted" ? "canceled" : sub.status,
            stripeSubscriptionId: sub.id,
            currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          });
        }
        break;
      }
    }
  } catch {
    // Return 500 so Stripe retries the delivery.
    return new NextResponse("Webhook handler failed", { status: 500 });
  }

  return NextResponse.json({ received: true });
}
