import { NextResponse, type NextRequest } from "next/server";

import { getUser } from "@/lib/auth/user";
import { getMarketResearch } from "@/lib/services/market-research.service";
import { getLatestJob } from "@/lib/services/job.service";

/**
 * GET /api/businesses/:businessId/market-research/status
 * Returns whether market research is ready and the latest job, for polling.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessId } = await params;
  const research = await getMarketResearch(businessId);
  const job = await getLatestJob(businessId, "market_research");

  return NextResponse.json({
    ready: Boolean(research?.generated_at),
    job: job ? { id: job.id, status: job.status, error: job.error } : null,
  });
}
