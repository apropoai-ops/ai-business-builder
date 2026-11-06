import { NextRequest, NextResponse } from "next/server";

import { finalizePlatformCharge } from "@/lib/services/platform-billing.service";

export const maxDuration = 30;

/**
 * Cardcom payment notification for the PLATFORM's own plan billing (the
 * owner's monthly starter/pro/business charge) — separate from
 * /api/payments/[provider]/callback, which is per-BUSINESS storefront
 * checkout. finalizePlatformCharge re-verifies server-to-server before
 * trusting anything and is idempotent against redelivery.
 *
 * Always 200 on a processed (even if unpaid) callback so Cardcom stops
 * retrying; verification failures throw below and surface as 400.
 */
async function handle(request: NextRequest) {
  try {
    await finalizePlatformCharge(request);
    return new NextResponse("OK");
  } catch {
    return new NextResponse("verification failed", { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  return handle(request);
}

export async function GET(request: NextRequest) {
  return handle(request);
}
