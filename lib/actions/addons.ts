"use server";

import { requireUser } from "@/lib/auth/user";
import { checkRateLimit } from "@/lib/rate-limit";
import { isBillingConfigured } from "@/lib/services/billing.service";
import { createAddonCheckoutSession } from "@/lib/services/addons.service";
import { ADDONS } from "@/lib/plans";

/** Starts a Stripe Checkout (subscription mode) for one paid add-on. */
export async function startAddonCheckoutAction(
  addonKey: string,
): Promise<{ url?: string; error?: string }> {
  const { user } = await requireUser();

  if (!ADDONS.some((a) => a.key === addonKey)) {
    return { error: "תוספת לא קיימת" };
  }
  if (!isBillingConfigured()) {
    return { error: "התשלומים יופעלו ממש בקרוב — בינתיים פנו אלינו לרכישה ידנית" };
  }
  if (!(await checkRateLimit(`addon-checkout:${user.id}`, 10, 3600))) {
    return { error: "יותר מדי בקשות כרגע — נסו שוב מאוחר יותר" };
  }

  try {
    const url = await createAddonCheckoutSession({
      userId: user.id,
      addonKey,
      customerEmail: user.email ?? undefined,
    });
    return { url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "התחלת התשלום נכשלה" };
  }
}
