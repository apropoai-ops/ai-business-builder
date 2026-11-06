import { NextRequest, NextResponse } from "next/server";

import { getConnectionCredentials } from "@/lib/services/payment-connections.service";
import { finalizePaidCheckout } from "@/lib/services/store-checkout.service";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/**
 * Payment notification (webhook) endpoint for merchant-connected Israeli
 * gateways. The provider posts here after a shopper pays; the store-checkout
 * redirect built the URL as /api/payments/{provider}/callback?b={businessId}.
 *
 * We look up the merchant's decrypted credentials for that provider and let the
 * driver VERIFY the notification (signature / server-side status query) before
 * trusting it — never mark an order paid on client-provided data alone. On a
 * verified payment we finalize the order (idempotent).
 *
 * Providers vary between GET and POST callbacks, so both are handled.
 */

/**
 * Best-effort, provider-agnostic scan of the raw callback body/query for a
 * reported paid amount (ILS decimal) under the field names the supported
 * gateways use (Tranzila/Grow "sum", the demo driver "amount", and a few
 * generic aliases). Runs on a CLONED request so it never disturbs the
 * driver's own single-read body parsing in verifyCallback below. Returns
 * null when nothing plausible is found — callers must treat that as "this
 * adapter doesn't expose an amount" rather than a mismatch; finalizePaidStoreOrder
 * only enforces the cross-check when an amount was actually recovered here.
 */
async function extractReportedAmount(request: Request): Promise<number | null> {
  try {
    const fields: Record<string, string> = {};
    const url = new URL(request.url);
    url.searchParams.forEach((v, k) => (fields[k] = v));

    if (request.method !== "GET") {
      const contentType = request.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const json = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        if (json) {
          for (const [k, v] of Object.entries(json)) {
            if (v != null) fields[k] = typeof v === "string" ? v : String(v);
          }
        }
      } else {
        const raw = await request.text().catch(() => "");
        if (raw) new URLSearchParams(raw).forEach((v, k) => (fields[k] = v));
      }
    }

    const candidates = ["sum", "amount", "Amount", "Sum", "total", "Total", "firstPaymentSum"];
    for (const key of candidates) {
      const raw = fields[key];
      if (!raw) continue;
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Replay guard. Some drivers verify the provider TRANSACTION server-to-server
 * but read our order id from the (attacker-supplied) callback body, so a
 * genuine paid transaction could be replayed against a different order. Each
 * (provider, providerRef) may settle exactly one order: the first claim wins,
 * a redelivery for the same order is allowed, any other order is refused.
 * A paid result without a providerRef can't be guarded and is refused too.
 */
async function claimTransaction(
  provider: string,
  providerRef: string | undefined,
  businessId: string,
  orderId: string,
): Promise<boolean> {
  if (provider === "demo") return true; // fake money; HMAC already binds order+amount
  if (!providerRef) return false;
  const s = createServiceRoleClient();
  const { error } = await s
    .from("payment_callback_claims")
    .insert({ provider, provider_ref: providerRef, business_id: businessId, order_id: orderId });
  if (!error) return true;
  if (error.code !== "23505") return false; // unknown failure — fail closed
  const { data: existing } = await s
    .from("payment_callback_claims")
    .select("order_id, business_id")
    .eq("provider", provider)
    .eq("provider_ref", providerRef)
    .maybeSingle();
  return !!existing && existing.order_id === orderId && existing.business_id === businessId;
}

async function handle(request: NextRequest, provider: string) {
  const businessId = new URL(request.url).searchParams.get("b");
  if (!businessId) return new NextResponse("Bad Request", { status: 400 });

  const conn = await getConnectionCredentials(businessId, provider);
  if (!conn) return new NextResponse("Not found", { status: 404 });

  try {
    // Independent, best-effort read of the reported amount off a CLONE of the
    // request — never interferes with the driver's own body parsing below.
    const reportedAmount = await extractReportedAmount(request.clone());

    const result = await conn.driver.verifyCallback(request, conn.credentials);
    if (result.paid && result.orderId) {
      if (!(await claimTransaction(provider, result.providerRef, businessId, result.orderId))) {
        console.error("[payments] refused replayed/unverifiable transaction", provider, businessId);
        return new NextResponse("verification failed", { status: 400 });
      }
      // The id may be a storefront order OR a rental booking — the drivers pass
      // one opaque id through and we can't tell which from here.
      await finalizePaidCheckout(result.orderId, undefined, reportedAmount, businessId);
    }
    // Always 200 on a processed (even if unpaid) callback so the provider stops
    // retrying; verification failures throw below and surface as 400.
    return new NextResponse("OK");
  } catch {
    return new NextResponse("verification failed", { status: 400 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  return handle(request, provider);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  return handle(request, provider);
}
