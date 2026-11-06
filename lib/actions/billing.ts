"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/user";
import {
  createPlanCharge,
  isPlatformBillingConfigured,
} from "@/lib/services/platform-billing.service";
import type { PlanTier } from "@/types/database";

/**
 * Starts a Cardcom checkout for a paid plan; redirects to Cardcom's hosted
 * payment page. Interim billing — see platform-billing.service.ts. Also
 * doubles as the manual monthly renewal: running this again for the same
 * tier opens a fresh charge.
 */
export async function startCheckoutAction(
  tier: Exclude<PlanTier, "free">,
): Promise<{ error?: string }> {
  const { user } = await requireUser();
  if (!isPlatformBillingConfigured()) {
    return { error: "התשלומים יופעלו ממש בקרוב — בינתיים פנו אלינו לשדרוג ידני" };
  }

  let url: string;
  try {
    url = await createPlanCharge(user.id, user.email ?? "", tier);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "התחלת התשלום נכשלה" };
  }
  redirect(url);
}

/**
 * No self-serve billing portal exists on the interim Cardcom path (that was
 * Stripe-only). Subscription-card.tsx only renders this action's button
 * when a Stripe customer id is on file, so in practice this is unreachable
 * for anyone billed after the Cardcom switchover — kept for any legacy
 * Stripe row still in place.
 */
export async function openBillingPortalAction(): Promise<{ error?: string }> {
  await requireUser();
  return { error: "ניהול מנוי עצמאי עוד לא זמין — לחדש חבילה: היכנסו ל/pricing ובחרו אותה מחדש" };
}
