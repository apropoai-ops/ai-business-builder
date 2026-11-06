import { NextResponse, type NextRequest } from "next/server";

import { getUser } from "@/lib/auth/user";
import { runMarketResearchJob } from "@/lib/jobs/handlers/market-research";

export const maxDuration = 120;

/**
 * POST /api/businesses/:businessId/market-research/generate
 * Runs (or resumes) market-research generation. Idempotent.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessId } = await params;
  const result = await runMarketResearchJob(businessId);

  const status = result.status === "failed" ? 500 : 200;
  return NextResponse.json(result, { status });
}
