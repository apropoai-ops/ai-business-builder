import { NextResponse, type NextRequest } from "next/server";

import { getUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import { getLatestJob } from "@/lib/services/job.service";

/**
 * GET /api/businesses/:businessId/status
 * Returns the business status and the latest business-plan job, for polling.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const job = await getLatestJob(businessId, "business_plan");

  return NextResponse.json({
    status: business.status,
    job: job
      ? { id: job.id, status: job.status, error: job.error }
      : null,
  });
}
