import { NextResponse, type NextRequest } from "next/server";

import { getUser } from "@/lib/auth/user";
import { runBusinessPlanJob } from "@/lib/jobs/handlers/business-plan";

// AI generation can take up to ~90s.
export const maxDuration = 120;

/**
 * POST /api/businesses/:businessId/generate
 * Runs (or resumes) the business-plan generation. Idempotent.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { businessId } = await params;
  const result = await runBusinessPlanJob(businessId);

  const status = result.status === "failed" ? 500 : 200;
  return NextResponse.json(result, { status });
}
