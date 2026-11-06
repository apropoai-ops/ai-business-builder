"use server";

import { getCustomerUser } from "@/lib/auth/customer";
import { checkRateLimit } from "@/lib/rate-limit";
import { upsertAbandonedCart } from "@/lib/services/abandoned-cart.service";

/**
 * Public: records the shopper's in-progress cart (called when they're at the
 * checkout step with a phone). Best-effort — failures are swallowed so they
 * never disrupt checkout.
 */
export async function trackAbandonedCartAction(
  slug: string,
  input: { name?: string; phone: string; items: { name: string; quantity: number }[]; total?: number },
): Promise<{ ok: boolean }> {
  try {
    if (!(await checkRateLimit(`cart:${slug}`, 60, 3600))) return { ok: false };
    const phone = (input.phone ?? "").trim().slice(0, 40);
    if (phone.replace(/\D/g, "").length < 9) return { ok: false };
    if (!Array.isArray(input.items) || input.items.length === 0) return { ok: false };

    const user = await getCustomerUser();
    await upsertAbandonedCart(slug, {
      name: input.name?.trim().slice(0, 120) || null,
      phone,
      items: input.items.slice(0, 50).map((i) => ({
        name: String(i.name).slice(0, 120),
        quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
      })),
      total: input.total != null ? Number(input.total) : null,
      userId: user?.id ?? null,
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
