import { NextResponse, type NextRequest } from "next/server";

import { getUser } from "@/lib/auth/user";
import { getLatestJob } from "@/lib/services/job.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessId } = await params;
  const job = await getLatestJob(businessId, "social_media");

  return NextResponse.json({
    job: job ? { id: job.id, status: job.status, error: job.error } : null,
  });
}
